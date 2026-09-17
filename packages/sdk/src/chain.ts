import {
  createPublicClient,
  createWalletClient,
  http,
  getAddress,
  type Address,
  type Hash,
  type PublicClient,
  type WalletClient,
} from "viem";
import { privateKeyToAccount, type PrivateKeyAccount } from "viem/accounts";
import {
  ARC_MIN_MAX_FEE_PER_GAS,
  assertChainId,
  type NetworkConfig,
} from "@gap402/config";
import {
  GAP_BOUNTY_ABI,
  GAP_BOUNTY_BYTECODE,
  MOCK_USDC_ABI,
  MOCK_USDC_BYTECODE,
  RECEIPT_REGISTRY_ABI,
} from "./generated/contracts.js";

/**
 * Chain adapter for gap402 on Arc. Wraps viem with:
 *  - mandatory chain-id verification before any transaction (fail closed)
 *  - Arc fee floor (min 20 gwei maxFeePerGas)
 *  - typed contract bindings generated from compiled artifacts
 */

const ERC20_MIN_ABI = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "allowance",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ type: "uint256" }],
  },
] as const;

export class Gap402Chain {
  readonly public: PublicClient;
  readonly network: NetworkConfig;
  private walletFor = new Map<string, WalletClient>();

  constructor(network: NetworkConfig) {
    this.network = network;
    this.public = createPublicClient({
      chain: network.chain,
      transport: http(network.rpcUrl),
    }) as PublicClient;
  }

  wallet(privateKey: `0x${string}`): WalletClient {
    let w = this.walletFor.get(privateKey);
    if (!w) {
      w = createWalletClient({
        account: privateKeyToAccount(privateKey),
        chain: this.network.chain,
        transport: http(this.network.rpcUrl),
      });
      this.walletFor.set(privateKey, w);
    }
    return w;
  }

  /** Must be called (and awaited) before sending any transaction. */
  async verifyNetwork(): Promise<void> {
    const chainId = await this.public.getChainId();
    assertChainId(this.network, chainId);
  }

  /** Enforce the Arc 20 gwei maxFeePerGas floor on a tx request. */
  private async feeFields(): Promise<{ maxFeePerGas: bigint }> {
    try {
      const gas = await this.public.getGasPrice();
      return {
        maxFeePerGas: gas > ARC_MIN_MAX_FEE_PER_GAS ? gas : ARC_MIN_MAX_FEE_PER_GAS,
      };
    } catch {
      return { maxFeePerGas: ARC_MIN_MAX_FEE_PER_GAS };
    }
  }

  async deployContracts(
    privateKey: `0x${string}`,
    opts?: {
      deployMockUsdc?: boolean;
    },
  ): Promise<{ usdc: Address; bounty: Address; registry: Address }> {
    await this.verifyNetwork();
    const wallet = this.wallet(privateKey);
    const account = wallet.account!;
    const fee = await this.feeFields();

    let usdc = this.network.usdcAddress;
    if (opts?.deployMockUsdc) {
      const hash = await wallet.deployContract({
        abi: MOCK_USDC_ABI,
        bytecode: MOCK_USDC_BYTECODE as `0x${string}`,
        account,
        chain: this.network.chain,
        ...fee,
      });
      const rcpt = await this.public.waitForTransactionReceipt({ hash });
      usdc = rcpt.contractAddress!;
    }

    const hash = await wallet.deployContract({
      abi: GAP_BOUNTY_ABI,
      bytecode: GAP_BOUNTY_BYTECODE as `0x${string}`,
      args: [usdc],
      account,
      chain: this.network.chain,
      ...fee,
    });
    const rcpt = await this.public.waitForTransactionReceipt({ hash });
    const bounty = rcpt.contractAddress!;
    const registry = (await this.public.readContract({
      address: bounty,
      abi: GAP_BOUNTY_ABI,
      functionName: "receiptRegistry",
    })) as Address;
    return { usdc, bounty, registry };
  }

  async mintMockUsdc(
    usdc: Address,
    privateKey: `0x${string}`,
    to: Address,
    amount: bigint,
  ): Promise<Hash> {
    await this.verifyNetwork();
    const fee = await this.feeFields();
    const wallet = this.wallet(privateKey);
    const hash = await wallet.writeContract({
      address: usdc,
      abi: MOCK_USDC_ABI,
      functionName: "mint",
      args: [to, amount],
      account: wallet.account!,
      chain: this.network.chain,
      ...fee,
    });
    await this.public.waitForTransactionReceipt({ hash });
    return hash;
  }

  async approveUsdc(
    privateKey: `0x${string}`,
    spender: Address,
    amount: bigint,
    usdcAddress?: Address,
  ): Promise<Hash> {
    await this.verifyNetwork();
    const fee = await this.feeFields();
    const wallet = this.wallet(privateKey);
    const hash = await wallet.writeContract({
      address: usdcAddress ?? this.network.usdcAddress,
      abi: ERC20_MIN_ABI,
      functionName: "approve",
      args: [spender, amount],
      account: wallet.account!,
      chain: this.network.chain,
      ...fee,
    });
    await this.public.waitForTransactionReceipt({ hash });
    return hash;
  }

  async createBounty(
    contract: Address,
    privateKey: `0x${string}`,
    args: {
      specHash: `0x${string}`;
      verifier: Address;
      amount: bigint;
      deadlineUnix: bigint;
      maxCommitments: number;
    },
  ): Promise<{ bountyId: bigint; txHash: Hash }> {
    await this.verifyNetwork();
    const fee = await this.feeFields();
    const wallet = this.wallet(privateKey);
    const hash = await wallet.writeContract({
      address: contract,
      abi: GAP_BOUNTY_ABI,
      functionName: "createBounty",
      args: [
        args.specHash,
        args.verifier,
        args.amount,
        args.deadlineUnix,
        args.maxCommitments,
      ],
      account: wallet.account!,
      chain: this.network.chain,
      ...fee,
    });
    const rcpt = await this.public.waitForTransactionReceipt({ hash });
    // BountyCreated(bountyId indexed) — parse from logs
    const log = rcpt.logs.find((l) => l.address.toLowerCase() === contract.toLowerCase());
    const bountyId = log?.topics[1] ? BigInt(log.topics[1]) : 0n;
    return { bountyId, txHash: hash };
  }

  async commitEvidence(
    contract: Address,
    privateKey: `0x${string}`,
    bountyId: bigint,
    evidenceHash: `0x${string}`,
  ): Promise<Hash> {
    await this.verifyNetwork();
    const fee = await this.feeFields();
    const wallet = this.wallet(privateKey);
    const hash = await wallet.writeContract({
      address: contract,
      abi: GAP_BOUNTY_ABI,
      functionName: "commitEvidence",
      args: [bountyId, evidenceHash],
      account: wallet.account!,
      chain: this.network.chain,
      ...fee,
    });
    await this.public.waitForTransactionReceipt({ hash });
    return hash;
  }

  async finalize(
    contract: Address,
    privateKey: `0x${string}`,
    bountyId: bigint,
    payouts: { recipient: Address; amount: bigint }[],
    settlementHash: `0x${string}`,
    receiptHash: `0x${string}`,
  ): Promise<Hash> {
    await this.verifyNetwork();
    // canonical order required by the contract: strictly increasing addresses
    const sorted = [...payouts].sort((a, b) =>
      a.recipient.toLowerCase() < b.recipient.toLowerCase() ? -1 : 1,
    );
    const fee = await this.feeFields();
    const wallet = this.wallet(privateKey);
    const hash = await wallet.writeContract({
      address: contract,
      abi: GAP_BOUNTY_ABI,
      functionName: "finalize",
      args: [
        bountyId,
        sorted.map((p) => getAddress(p.recipient)),
        sorted.map((p) => p.amount),
        settlementHash,
        receiptHash,
      ],
      account: wallet.account!,
      chain: this.network.chain,
      ...fee,
    });
    await this.public.waitForTransactionReceipt({ hash });
    return hash;
  }

  async cancel(
    contract: Address,
    privateKey: `0x${string}`,
    bountyId: bigint,
  ): Promise<Hash> {
    await this.verifyNetwork();
    const fee = await this.feeFields();
    const wallet = this.wallet(privateKey);
    const hash = await wallet.writeContract({
      address: contract,
      abi: GAP_BOUNTY_ABI,
      functionName: "cancel",
      args: [bountyId],
      account: wallet.account!,
      chain: this.network.chain,
      ...fee,
    });
    await this.public.waitForTransactionReceipt({ hash });
    return hash;
  }

  async getBounty(contract: Address, bountyId: bigint) {
    return (await this.public.readContract({
      address: contract,
      abi: GAP_BOUNTY_ABI,
      functionName: "getBounty",
      args: [bountyId],
    })) as {
      requester: Address;
      verifier: Address;
      amount: bigint;
      deadline: bigint;
      createdAt: bigint;
      state: number;
      specHash: `0x${string}`;
      settlementHash: `0x${string}`;
      receiptHash: `0x${string}`;
      commitments: number;
      maxCommitments: number;
    };
  }

  async isReceiptAnchored(
    registry: Address,
    receiptHash: `0x${string}`,
  ): Promise<boolean> {
    return (await this.public.readContract({
      address: registry,
      abi: RECEIPT_REGISTRY_ABI,
      functionName: "isAnchored",
      args: [receiptHash],
    })) as boolean;
  }

  async usdcBalanceOf(address: Address, usdcAddress?: Address): Promise<bigint> {
    return (await this.public.readContract({
      address: usdcAddress ?? this.network.usdcAddress,
      abi: ERC20_MIN_ABI,
      functionName: "balanceOf",
      args: [address],
    })) as bigint;
  }
}

export function accountFromKey(privateKey: `0x${string}`): PrivateKeyAccount {
  return privateKeyToAccount(privateKey);
}
