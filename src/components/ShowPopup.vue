<template>
    <section class="section">
        <h2>Claim Rewards</h2>
        <div>
            <div v-if="rewardEntryData">
                <p>Reward Amount: {{ rewardEntryData.rewardAmount }}</p>
            </div>
            <button @click="claimReward">Claim</button>
        </div>
        <button @click="checkAmount">Check Amount</button>
    </section>
</template>  
  

<script setup>
// import { ShowPopup } from "src/components/ShowPopup.vue";
// import { WalletMultiButton } from "solana-wallets-vue";
import { useWallet } from 'solana-wallets-vue '
import {
    ref,
    // computed,
    onMounted
} from 'vue';

// import { watch } from 'vue';
import {
    PublicKey,
    clusterApiUrl,
    Transaction,
    SystemProgram
    // Keypair
} from '@solana/web3.js';

import { utils, BN, BorshAccountsCoder } from "@coral-xyz/anchor"; //, AnchorProvider
import {
    TOKEN_PROGRAM_ID,
    getAssociatedTokenAddressSync,
    getAccount,
    createTransferInstruction
} from '@solana/spl-token';

import {
    executeTransactions,
    withFindOrInitAssociatedTokenAccount
} from "@cardinal/common";

// const recentPlays = ref([
//     {
//         imageSrc: require('@/images/cf_heads.png'),
//         imageAlt: 'Coin Icon',
//         userName: 'Someone',
//         amount: 500.00,
//         coinSide: 'Heads',
//         result: 'doubled',
//         timeAgo: '51 minutes ago'
//     },
//     {
//         imageSrc: require('@/images/cf_heads.png'),
//         imageAlt: 'Coin Icon',
//         userName: 'Someone',
//         amount: 170.00,
//         coinSide: 'Heads',
//         result: 'rugged',
//         timeAgo: '20 hours ago'
//     },
//     {
//         imageSrc: require('@/images/cf_heads.png'),
//         imageAlt: 'Coin Icon',
//         userName: 'Someone',
//         amount: 12.85,
//         coinSide: 'Heads',
//         result: 'rugged',
//         timeAgo: '1 day ago'
//     },
//     {
//         imageSrc: require('@/images/cf_tails.png'),
//         imageAlt: 'Coin Icon',
//         userName: 'Someone',
//         amount: 140.00,
//         coinSide: 'Tails',
//         result: 'doubled',
//         timeAgo: '2 days ago'
//     },
//     {
//         imageSrc: require('@/images/cf_tails.png'),
//         imageAlt: 'Coin Icon',
//         userName: 'Someone',
//         amount: 0.30,
//         coinSide: 'Tails',
//         result: 'doubled',
//         timeAgo: '3 days ago'
//     },
//     {
//         imageSrc: require('@/images/cf_tails.png'),
//         imageAlt: 'Coin Icon',
//         userName: 'Someone',
//         amount: 400.00,
//         coinSide: 'Tails',
//         result: 'rugged',
//         timeAgo: '3 days ago'
//     },
//     // Add more play objects here with similar structure
// ]);


const anchor = require('@project-serum/anchor');
let wallet
let connection
let provider
const COINGAME_PROGRAM_ADDRESS = new PublicKey("7m69C1L22UGQs4NBiyDaPvVz6WRiXKTiPTt1im2hr3Fw")
async function setUp() {
    console.log('connecting wallet......')
    wallet = useWallet();
    wallet.publicKey = wallet.publicKey.value ?? wallet.publicKey;
    wallet.signAllTransactions = wallet.signAllTransactions.value ?? wallet.signAllTransactions
    console.log('wallet:', wallet)

    console.log('connecting Url......')
    connection = new anchor.web3.Connection(clusterApiUrl('devnet'))
    console.log('setting providor......')
    provider = new anchor.AnchorProvider(connection, wallet) //, AnchorProvider.defaultOptions()
    console.log('provider:', provider)
}
let idl //F6YzUPirXo8UBX8Z5YcLicryVEuJKmhqvsYG3dTPBXUL
let program;

async function findProgram() {
    console.log('finding program......')
    // connect to program
    try {
        let retryCount = 0;
        while (!idl && retryCount < 5) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // 等待 1 秒
            idl = await anchor.Program.fetchIdl(COINGAME_PROGRAM_ADDRESS, provider); //COINGAME_PROGRAM_ADDRESS   //new PublicKey('F6YzUPirXo8UBX8Z5YcLicryVEuJKmhqvsYG3dTPBXUL')
            retryCount++;
        }

        if (idl) {
            program = new anchor.Program(idl, COINGAME_PROGRAM_ADDRESS, provider);
            console.log('program:', program)
        } else {
            console.error('IDL is still null after multiple retries. Initialization failed.');
        }
    } catch (error) {
        console.error('Failed to fetch IDL:', error);
    }
}

let userRewardMintAtaId
let rewardMintId = new PublicKey('2inV5JYpdUc5MAgqY6tWx11Bm3694PDm3GmjFLpN4tfz')
let entryId = 'user4' //'user1' // id should be user's address (provider.wallet.publicKey.toString())
let rewardEntryId
let rewardDistributorId

async function findAccountAndAddress() {
    userRewardMintAtaId = getAssociatedTokenAddressSync(
        rewardMintId,
        provider.wallet.publicKey
    );
    console.log('userRewardMintAtaId:', userRewardMintAtaId.toBase58())

    rewardEntryId = PublicKey.findProgramAddressSync(
        [
            utils.bytes.utf8.encode("reward_entry_state"),
            utils.bytes.utf8.encode(entryId)
        ],
        COINGAME_PROGRAM_ADDRESS
    )[0];
    console.log('rewardEntryId:', rewardEntryId.toBase58())


    rewardDistributorId = PublicKey.findProgramAddressSync(
        [
            utils.bytes.utf8.encode("reward_distributor_state"),
            utils.bytes.utf8.encode('testidentifier1')
        ],
        COINGAME_PROGRAM_ADDRESS
    )[0];
    console.log('rewardDistributorId:', rewardDistributorId.toBase58())
}

let rewardEntryData = ref()

async function getRewardEntry() {
    try {
        rewardEntryData.value = await program.account.rewardEntry.fetch(rewardEntryId);
        // console.log('Already have reward entry:', rewardEntryData.value);
        console.log('rewardAmount:', rewardEntryData.value.rewardAmount.toString());
    } catch (error) {
        rewardEntryData.value = null;
    }
}

async function gameProgramCount() {
    const programDetail = await connection.getProgramAccounts(
        COINGAME_PROGRAM_ADDRESS,
        {
            filters: [
                {
                    memcmp: {
                        offset: 0,
                        bytes: utils.bytes.bs58.encode(
                            BorshAccountsCoder.accountDiscriminator('GameState')
                        )
                    }
                }
            ]
        }
    )

    console.log('programDetail length:', programDetail.length)

    return programDetail.length   
}  
  
/* 
Start Game:
1. Create Reward Entry (option) (只能一個所以還需要條件判斷) (先判斷用輸入的user's address建的reward entry是否存在，存在直接用不存在新建)
2. Bet
3. Play (head) 
*/

async function startGame(side, betAmount)  { //, gameId
    console.log(side, betAmount)

    const gameid = await gameProgramCount()
    const gameId = (gameid + 1).toString()

    console.log('gameId:', gameId)
    const gameStateId = PublicKey.findProgramAddressSync(
        [
            utils.bytes.utf8.encode("game_state"),
            utils.bytes.utf8.encode(gameId)
        ],
        COINGAME_PROGRAM_ADDRESS
    )[0];
    console.log('gameStateId:', gameStateId.toBase58())
    
    const txs = []
    const tx = new Transaction();

    
    

    console.log('betAmount:', betAmount)
    const betIx = await program.methods
        .bet({
            betAmount: new BN(betAmount * (10 ** 6)),
            identifier: gameId
        })
        .accounts({
            rewardDistributor: rewardDistributorId,
            coinGame: gameStateId,
            rewardMint: rewardMintId,
            rewardDistributorTokenAccount: new PublicKey('DEUHs3iJZEGf9uQ8GTzEHi1ekD51JQUSiMkMvYKLe7Mv'), //rewardDistributorAtaId,
            userRewardMintTokenAccount: userRewardMintAtaId,
            authority: provider.wallet.publicKey,
            player: provider.wallet.publicKey,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID
        })
        .instruction();

    console.log('side choose(Head=1, Tail=2):', side)
    const playIx = await program.methods
        .play({
            side: side,  // Head1 Tail2
            identifier: gameId,
        })
        .accounts({
            player: provider.wallet.publicKey,
            coinGame: gameStateId,
            rewardEntry: rewardEntryId,
            systemProgram: SystemProgram.programId,
        })
        .instruction();

    try {
        let findRrewardEntry = await program.account.rewardEntry.fetch(rewardEntryId);
        console.log('Already have reward entry:', findRrewardEntry)

        tx.add(betIx, playIx)
    } catch (error) {
        console.log('No reward entry')

        const initRewardEntryIx = await program.methods
            .initRewardEntry({
                identifier: entryId,
            })
            .accounts({
                rewardEntry: rewardEntryId,
                rewardDistributor: rewardDistributorId,
                rewardMint: rewardMintId,
                authority: provider.wallet.publicKey, //payer.publicKey, 
                player: provider.wallet.publicKey,
                systemProgram: SystemProgram.programId,
                tokenProgram: TOKEN_PROGRAM_ID
            })
            .instruction();

        tx.add(initRewardEntryIx, betIx, playIx)
    }
    console.log('tx:', tx)
    txs.push(tx)

    const result = await executeTransactions(provider.connection, txs, provider.wallet.wallet.value.adapter); //provider.wallet.wallet.value
    console.log('--------- Start Game ---------')
    console.log('success', result)

    // fetch game program
    let fetchedCoinGameStateId
    while (!fetchedCoinGameStateId) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // wait for 1 second
        try {
            fetchedCoinGameStateId = await program.account.gameState.fetch(gameStateId);
        } catch (error) {
            fetchedCoinGameStateId = null;
        }

        if (fetchedCoinGameStateId == null) {
            console.log('loading...')
        } else {
            console.log('fetchedCoinGameStateId:', fetchedCoinGameStateId)
        }
    }

    await getRewardEntry()
}

async function gameResult(gameId) {
    console.log('gameId:', gameId)
    const gameStateId = PublicKey.findProgramAddressSync(
        [
            utils.bytes.utf8.encode("game_state"),
            utils.bytes.utf8.encode(gameId) // a random id
        ],
        COINGAME_PROGRAM_ADDRESS
    )[0];
    console.log('gameStateId:', gameStateId.toBase58())

    let fetchedCoinGameStateId = await program.account.gameState.fetch(gameStateId);
    console.log('fetchedCoinGameStateId:', fetchedCoinGameStateId)
}

/*
Claim Reward
*/
async function claimReward() {
    let rewardAmount
    if (rewardEntryData.value) {
        rewardAmount = rewardEntryData.value.rewardAmount
    } else {
        console.log('no reward entry: rewardAmount -> new BN(0)')
        rewardAmount = new BN(0)
    }

    if (rewardAmount.eq(new BN(0))) {
        console.log('reward = 0')
    } else {
        console.log('reward amount:', rewardAmount.toString())

        const txs = []
        const tx = new Transaction();
        const ix = await program.methods
            .claimRewards({})
            .accounts({
                rewardEntry: rewardEntryId,
                rewardDistributor: rewardDistributorId,
                rewardMint: rewardMintId,
                coinGame: new PublicKey('5rabskir8igALfo3j2Pk1S9mMxZju3N9Ynz3KdE55kn7'),
                rewardDistributorTokenAccount: new PublicKey('DEUHs3iJZEGf9uQ8GTzEHi1ekD51JQUSiMkMvYKLe7Mv'), //rewardDistributorAtaId,
                userRewardMintTokenAccount: userRewardMintAtaId,
                authority: provider.wallet.publicKey,
                player: provider.wallet.publicKey,
                systemProgram: SystemProgram.programId,
                tokenProgram: TOKEN_PROGRAM_ID
            })
            .instruction();

        tx.add(ix)
        txs.push(tx)

        const result = await executeTransactions(provider.connection, txs, provider.wallet.wallet.value.adapter); //provider.wallet.wallet.value
        console.log('--------- Claim Rewards ---------')
        console.log('success', result)
    }

    await getRewardEntry()
}

async function checkAmount() {
    let rewardDistributorAta = await getAccount(
        provider.connection,
        // rewardDistributorAtaId
        new PublicKey('DEUHs3iJZEGf9uQ8GTzEHi1ekD51JQUSiMkMvYKLe7Mv')
    );
    console.log('rewardDistributorAta:', rewardDistributorAta.amount)

    let userMintAta = await getAccount(
        provider.connection,
        userRewardMintAtaId
    );
    console.log('userMintAta:', userMintAta.amount)

}






async function aTob() {
    const txs = []
    const tx = new Transaction();

    // set the initial amount
    tx.add(
        createTransferInstruction(
            userRewardMintAtaId,
            new PublicKey('DEUHs3iJZEGf9uQ8GTzEHi1ekD51JQUSiMkMvYKLe7Mv'),
            // userRewardMintAtaId,
            provider.wallet.publicKey,
            100
        )
    );

    txs.push(tx)

    const result = await executeTransactions(provider.connection, txs, provider.wallet.wallet.value.adapter); //provider.wallet.wallet.value
    console.log('--------- Start Game ---------')
    console.log('success', result)
}
async function bToa() {
    const txs = []
    const tx = new Transaction();

    // set the initial amount
    tx.add(
        createTransferInstruction(
            new PublicKey('DEUHs3iJZEGf9uQ8GTzEHi1ekD51JQUSiMkMvYKLe7Mv'),
            userRewardMintAtaId,
            provider.wallet.publicKey,
            100
        )
    );

    txs.push(tx)

    const result = await executeTransactions(provider.connection, txs, provider.wallet.wallet.value.adapter); //provider.wallet.wallet.value
    console.log('--------- Start Game ---------')
    console.log('success', result)
}
/*
 ['Program ComputeBudget111111111111111111111111111111 invoke [1]', 
'Program ComputeBudget111111111111111111111111111111 success', 
'Program ComputeBudget111111111111111111111111111111 invoke [1]', 
'Program ComputeBudget111111111111111111111111111111 success', 
'Program TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA invoke [1]', 
'Program log: Instruction: Transfer', 
'Program log: Error: owner does not match', 
'Program TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA consumed 4470 of 199700 compute units', 
'Program TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA failed: custom program error: 0x4']
  0: "Program ComputeBudget111111111111111111111111111111 invoke [1]"
  1: "Program ComputeBudget111111111111111111111111111111 success"
  2: "Program ComputeBudget111111111111111111111111111111 invoke [1]"
  3: "Program ComputeBudget111111111111111111111111111111 success"
  4: "Program TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA invoke [1]"
  5: "Program log: Instruction: Transfer"
  6: "Program log: Error: owner does not match"
  7: "Program TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA consumed 4470 of 199700 compute units"
  8: "Program TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA failed: custom program error: 0x4"length: 
  9[[Prototype]]: Array(0) 'failed to send transaction: Transaction simulation failed: Error processing Instruction 2: custom program error: 0x4'
*/

async function viewProgram() {
    console.log('ppp:', program)
    console.log('rewardMintId:', rewardMintId)
}

/*
Init Reward Distributor
*/
async function initRwardDistributor() {
    console.log('aabbc')

    // rewardDistributorAtaId: DEUHs3iJZEGf9uQ8GTzEHi1ekD51JQUSiMkMvYKLe7Mv
    // userRewardMintAta: FD5ZNWRUYbusnA8qdNPZREaXPxz5QvRKFPHjHrtzEsay

    const txs = []
    const tx = new Transaction();
    const ix = await program.methods
        .initRewardDistributor({
            identifier: 'testidentifier1',
        })
        .accountsStrict({
            rewardDistributor: rewardDistributorId,
            rewardMint: rewardMintId,
            authority: provider.wallet.publicKey,
            player: provider.wallet.publicKey,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID
        })
        .instruction();

    console.log('ix:', ix)
    tx.add(ix)

    let rewardDistributorAtaId = await withFindOrInitAssociatedTokenAccount(
        tx,
        provider.connection,
        rewardMintId,
        rewardDistributorId,
        provider.wallet.publicKey,
        true
    );
    console.log('rewardDistributorAtaId:', rewardDistributorAtaId.toBase58())

    let userRewardMintAta = getAssociatedTokenAddressSync(
        rewardMintId,
        provider.wallet.publicKey
    );
    console.log('userRewardMintAta:', userRewardMintAta.toBase58())

    // set the initial amount
    tx.add(
        createTransferInstruction(
            userRewardMintAta,
            rewardDistributorAtaId,
            provider.wallet.publicKey,
            500
        )
    );

    console.log(provider.wallet.publicKey.toString())
    console.log(provider.wallet.publicKey.toBase58())
    console.log(provider.wallet.wallet.value.adapter)

    txs.push(tx)

    const result = await executeTransactions(provider.connection, txs, provider.wallet.wallet.value.adapter); //provider.wallet.wallet.value
    console.log('--------- Init Reward Distributor ---------')
    console.log('success', result)

    // get reward distributor
    let fetchedrewardDistributorId = await program.account.rewardDistributor.fetch(rewardDistributorId);
    console.log('fetchedrewardDistributorId:', fetchedrewardDistributorId)
}



onMounted(async () => {
    await setUp()
    console.log("Player Publickey:", wallet.publicKey.toString())
//     console.log('Player Publickey:', wallet.publicKey.value.toBase58());
//     if (wallet.publicKey.value) {
//   console.log('Player Publickey:', wallet.publicKey.value.toBase58());
// } else {
//   console.log('Wallet public key is null or undefined.');
// }


    await findAccountAndAddress()
    await findProgram()
    console.log('------------- Hello player. -------------')
    await getRewardEntry()
});

viewProgram,
    initRwardDistributor,
    startGame,
    claimReward,
    checkAmount,
    rewardEntryData,
    gameResult,
    gameProgramCount,
    aTob,
    bToa

</Script>