import { Connection, PublicKey } from '@solana/web3.js'
import {
  calculateDelegatedGovernancePower,
  calculateNativeGovernancePower,
  getPrograms,
  getTokenOwnerRecord,
} from './vsr-vote-power.helpers.js'

export async function getCanonicalGovernancePower({
  walletAddress,
  connection,
}: {
  walletAddress: string
  connection: Connection
}) {
  const walletPubkey = new PublicKey(walletAddress)
  const { ISLAND_DAO_REGISTRAR, VSR_PROGRAM_ID } = getPrograms()
  console.log(`🏛️ Getting canonical governance power for: ${walletAddress}`)

  try {
    console.log(`🔍 SDK: Program ID: ${VSR_PROGRAM_ID.toBase58()}`)
    console.log(`🔍 SDK: Registrar PDA: ${ISLAND_DAO_REGISTRAR.toBase58()}`)

    // Find all VSR accounts for this wallet using comprehensive search
    console.log(`🔍 SDK: Searching for VSR accounts owned by wallet...`)

    // First try standard memcmp at offset 8
    let allVSRAccounts = await connection.getProgramAccounts(VSR_PROGRAM_ID, {
      filters: [
        {
          memcmp: {
            offset: 8, // Authority field offset in Voter accounts
            bytes: walletPubkey.toBase58(),
          },
        },
      ],
    })

    // For Takisoul specifically, also check known accounts to ensure we get all VSR accounts
    // if (walletPubkey.toBase58() === '7pPJt2xoEoPy8x8Hf2D6U6oLfNa5uKmHHRwkENVoaxmA') {
    //   console.log(`🔍 SDK: Expanding search for Takisoul's additional VSR accounts...`)
    //
    //   const knownAccounts = [
    //     'GSrwtiSq6ePRtf2j8nWMksgMuGawHv8uf2suz1A5iRG',
    //     '9dsYHH88bN2Nomgr12qPUgJLsaRwqkX2YYiZNq4kys5L',
    //     'C1vgxMvvBzXegFkvfW4Do7CmyPeCKsGJT7SpQevPaSS8',
    //   ]
    //
    //   // Add any missing known accounts
    //   for (const accountAddress of knownAccounts) {
    //     const exists = allVSRAccounts.find((acc) => acc.pubkey.toBase58() === accountAddress)
    //     if (!exists) {
    //       try {
    //         const accountPubkey = new PublicKey(accountAddress)
    //         const accountInfo = await connection.getAccountInfo(accountPubkey)
    //         if (accountInfo) {
    //           allVSRAccounts.push({
    //             pubkey: accountPubkey,
    //             account: accountInfo,
    //           })
    //         }
    //       } catch (error) {
    //         console.log(`🔍 SDK: Could not fetch known account ${accountAddress}: ${error.message}`)
    //       }
    //     }
    //   }
    // }

    console.log(`🔍 SDK: Found ${allVSRAccounts.length} VSR accounts for wallet`)

    // Calculate native and delegated governance power using canonical methodology
    const [nativeResult, delegatedPower] = await Promise.all([
      calculateNativeGovernancePower({ connection, walletPubkey }),
      calculateDelegatedGovernancePower({ connection, walletPubkey }),
    ])

    const totalPower = nativeResult.totalPower + delegatedPower

    if (totalPower > 0) {
      return {
        wallet: walletPubkey.toBase58(),
        nativeGovernancePower: nativeResult.totalPower,
        delegatedGovernancePower: delegatedPower,
        totalGovernancePower: totalPower,
        deposits: nativeResult.deposits.length > 0 ? nativeResult.deposits : undefined,
        source: 'vsr_sdk',
      }
    }

    // Check for TokenOwnerRecord if no VSR power found
    const torResult = await getTokenOwnerRecord({ connection, walletPubkey })
    if (torResult.governingTokenDepositAmount > 0) {
      return {
        wallet: walletPubkey.toBase58(),
        nativeGovernancePower: torResult.governingTokenDepositAmount,
        delegatedGovernancePower: 0,
        totalGovernancePower: torResult.governingTokenDepositAmount,
        source: 'token_owner_record',
        details: {
          depositAmount: torResult.governingTokenDepositAmount,
          mint: torResult.governingTokenMint,
        },
      }
    }

    // Return zero power if no governance power found
    return {
      wallet: walletPubkey.toBase58(),
      nativeGovernancePower: 0,
      delegatedGovernancePower: 0,
      totalGovernancePower: 0,
      source: 'none',
    }
  } catch (error) {
    console.error(`🔍 SDK: Error in canonical governance calculation:`, error)
    return {
      nativeGovernancePower: 0,
      delegatedGovernancePower: 0,
      totalGovernancePower: 0,
      source: 'error',
      error,
    }
  }
}
