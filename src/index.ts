// Load environment variables from .env file
import 'dotenv/config'
// Colors and prompts, yay!
import c from 'kleur'
import prompts from 'prompts'

// Solana Client SDK
import { createSolanaClient, getMonikerFromGenesisHash, isAddress } from 'gill'
// Solana Client SDK (Node.js)
import { loadKeypairSignerFromFile } from 'gill/node'
import { Connection } from '@solana/web3.js'
import { getCanonicalGovernancePower } from './get-canonical-governance-power.js'

// Get the Solana RPC endpoint from the environment variable or default to devnet
const urlOrMoniker = process.env.SOLANA_RPC_ENDPOINT || 'devnet'
const client = createSolanaClient({ urlOrMoniker })
const connection = new Connection(urlOrMoniker, 'confirmed')

// Load the keypair from the .env file or use the default (~/.config/solana/id.json)
const signer = await loadKeypairSignerFromFile(process.env.SOLANA_SIGNER_PATH)

// Welcome message
console.log(c.green(c.bold('IslandDAO VSR Holders')))

// Show the endpoint and cluster
console.log(c.gray(`Endpoint: ${urlOrMoniker.split('?')[0]}`))
const cluster = getMonikerFromGenesisHash(await client.rpc.getGenesisHash().send())
console.log(c.gray(`Cluster : ${c.white(cluster)}`))

// Prompt the user for an address
const res = await prompts({ type: 'text', name: 'address', message: 'Check voter address', validate: isAddress })
if (!res.address) {
  console.log(c.red('No address provided'))
  process.exit(1)
}
// Show the address and balance
await getCanonicalGovernancePower({ connection, walletAddress: res.address })
