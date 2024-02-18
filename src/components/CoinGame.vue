<template>
  <h1>Coin Flip</h1>
  <section class="section">
    <h2>Start Game</h2>
    <div>
      <label>
        Bet Amount:
        <input v-model="betAmount" type="number" />
      </label>
      <br>
      <button @click="startGame(1, betAmount)">Head</button>
      <button @click="startGame(2, betAmount)">Tail</button>
      <!-- <button @click="gameResult(gameId)">gameResult</button> -->
    </div>
  </section>
  <section class="section">
    <h2>Claim Rewards</h2>
    <div>
      <div v-if="rewardEntryData">
        <p>Reward Amount: {{ rewardEntryData.rewardAmount }}</p>
      </div>
      <button @click="claimReward()">claim</button>
    </div>
    <button @click="checkAmount()">checkAmount</button>
  </section>
  <section class="section">
    <h2>Other Buttons</h2>
    <div>
      <button @click="viewProgram()">viewProgram</button>
      <button @click="gameProgramCount()">gameProgramCount</button>
      <button @click="initRwardDistributor()">initRwardDistributor</button>
    </div>
    <div>
      <button @click="aTob()">player To reward distributor</button>
      <button @click="bToa()">reward distributor To player (owner not match)</button>
      <button @click="aTob()">authority To reward distributor</button>
      <button @click="bToa()">reward distributor To authority</button>
    </div>
  </section>
</template>

<script>
import { useWallet } from 'solana-wallets-vue'
import { onMounted, ref } from 'vue';
import {
  PublicKey,
  clusterApiUrl,
  Transaction,
  SystemProgram,
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

const anchor = require('@project-serum/anchor');

export default {
  name: 'CoinGame',
  props: {
    msg: String
  },
  setup() {
    /*
    Set up
    */
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
    let entryId = 'user2' //'user1' // id should be user's address (provider.wallet.publicKey.toString())
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
    async function startGame(side, betAmount) { //, gameId
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
      await findAccountAndAddress()
      await findProgram()
      console.log('------------- Hello player. -------------')
      await getRewardEntry()
    });

    return {
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
    }
  }
}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
.section {
  margin-top: 30px;
  margin-bottom: 100px;
}
</style>



<script setup>
// import { createApp } from "vue";
// import BackCoin from "@/composables/BackCoin.js"; 
// import { ref } from 'vue' 
import { WalletMultiButton } from "solana-wallets-vue";
import { useWallet } from 'solana-wallets-vue'
import {
    ref,
    computed,
    onMounted,
    inject
} from 'vue';

import { watch }  from 'vue'; 
import {
    PublicKey,
    clusterApiUrl ,
    Transaction,
    SystemProgram 
    // Keypair
} from '@solana/web3.js' ;

import { utils, BN, BorshAccountsCoder } from "@coral-xyz/anchor"; //, AnchorProvider
import {
    TOKEN_PROGRAM_ID,
    getAssociatedTokenAddressSync,
    getAccount,
    // createTransferInstruction
} from '@solana/spl-token';

import {
    executeTransactions, 
    // withFindOrInitAssociatedTokenAccount
} from "@cardinal/common"; 
const isHeads = ref(true);
const isFlipping = ref(false);

const flipCoins = () => {
  if (!isFlipping.value) { 
    isFlipping.value = true;
    setTimeout(() => {
      isHeads.value = !isHeads.value;
      isFlipping.value = false;
    }, 1000);
  }
};
const isModalOpen = ref(false); 
const closeModal = () => {
    isModalOpen.value = false;
};
// 使用 ref 創建反應式數據
const flipsPopupVisible = ref(false);

// 顯示 Your Flips 彈跳視窗函數
const showFlipsPopup = () => {
    flipsPopupVisible.value = true;
};
// 關閉 Your Flips 彈跳視窗函數
const closeFlipsPopup = () => {
    flipsPopupVisible.value = false;
};
const recentPlays = ref([]);
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

//呼叫'@project-serum/anchor'的package
const anchor = require  ('@project-serum/anchor' ); 
let wallet 
let connection
let provider
//COINGAME的專屬地址
const COINGAME_PROGRAM_ADDRESS = new PublicKey("7m69C1L22UGQs4NBiyDaPvVz6WRiXKTiPTt1im2hr3Fw")
const cryptojs = inject('cryptojs') 
    console.log('cryptojs', cryptojs ) 

async function setUp() { 
    console.log('connecting wallet......')
    wallet = useWallet();
    
    //確認內容物是正確
    wallet.publicKey = wallet.publicKey.value ?? wallet.publicKey;
    wallet.signAllTransactions = wallet.signAllTransactions.value ?? wallet.signAllTransactions
    console.log('wallet:', wallet)

    console.log('connecting Url......')
    //用anchor裡的Connection funtion連接到測試網
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
    //try：只要有error，就會跳到catch
    try {
        let retryCount = 0;
        while (!idl && retryCount < 5) {
            await new Promise(resolve => setTimeout(resolve, 1000)); // 等待 1 秒
            idl = await anchor.Program.fetchIdl(COINGAME_PROGRAM_ADDRESS, provider); //COINGAME_PROGRAM_ADDRESS   //new PublicKey('F6YzUPirXo8UBX8Z5YcLicryVEuJKmhqvsYG3dTPBXUL')
            retryCount++;
        }

        //如果idl存在,用idl找program
        if (idl) {
            program = new anchor.Program(idl, COINGAME_PROGRAM_ADDRESS, provider);
            console.log('program:', program)
        } else {
            console.error('IDL is still null after multiple retries. Initialization failed.');
        }
    } catch (error) {
        console.error('Failed to fetch IDL:',  error);
    }
}

//Mint傳送
let userRewardMintAtaId
//new PublicKey 是把字串轉為bn法
let rewardMintId = new PublicKey('2inV5JYpdUc5MAgqY6tWx11Bm3694PDm3GmjFLpN4tfz') //錢幣的地址
// let entryId = 'user2' //'user1' // id should be user's address (provider.wallet.publicKey.toString())
let rewardEntryId
let rewardDistributorId

async function findAccountAndAddress() {
    //用錢幣地址跟用戶地址找ata(AssociatedTokenAddress)用來transfer錢幣
    userRewardMintAtaId = getAssociatedTokenAddressSync(
        rewardMintId,
        provider.wallet.publicKey
    );
    console.log('userRewardMintAtaId:', userRewardMintAtaId.toBase58())
    
    //每一個用戶專屬的紀錄器的id

    let address = provider.wallet.publicKey.toString()
      console.log('address:', address)
      // let hexString = cryptojs.createHash('sha256').update(address, 'utf-8').digest('hex')
      // console.log('hexString:', hexString)

      // Using SHA256 from cryptojs
      let hexString = cryptojs.algo.SHA256.create().finalize(address).toString(cryptojs.enc.Hex);
      console.log('hexString:', hexString);

      let entryIdentifier = Uint8Array.from(Buffer.from(hexString, 'hex'))
      console.log('entryIdentifier:', entryIdentifier)





    rewardEntryId = PublicKey.findProgramAddressSync(
        [
            utils.bytes.utf8.encode("reward_entry_state"),
            entryIdentifier
            // utils.bytes.utf8.encode(entryId) //之後會改成用戶的address
        ],
        COINGAME_PROGRAM_ADDRESS
    )[0];
    console.log('rewardEntryId:', rewardEntryId.toBase58())

    //管理遊戲所有錢幣的分配器id
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

//用rewardEntryId找RewardEntry
async function getRewardEntry() {
    try {
        rewardEntryData.value = await program.account.rewardEntry.fetch(rewardEntryId);
        // console.log('Already have reward entry:', rewardEntryData.value);
        console.log('rewardAmount:', rewardEntryData.value.rewardAmount.toString());
    } catch (error) {
        rewardEntryData.value = null;
    }
}

//去抓遊戲跑了幾次
// async function gameProgramCount() {
//     const programDetail = await connection.getProgramAccounts(
//         COINGAME_PROGRAM_ADDRESS,
//         {
//             filters: [
//                 {
//                     memcmp: {
//                         offset: 0,
//                         bytes: utils.bytes.bs58.encode(
//                             BorshAccountsCoder.accountDiscriminator('GameState')
//                         )
//                     }
//                 }
//             ]
//         }
//     )

//     console.log('programDetail length:', programDetail.length)

//     return programDetail.length
// }

/*
Start Game:
1. Create Reward Entry (option) (只能一個所以還需要條件判斷) (先判斷用輸入的user's address建的reward entry是否存在，存在直接用不存在新建)
2. Bet
3. Play (head)
*/


async function startGame(side, betAmount) { //, gameId
    console.log(side, betAmount)

    const gameid = await gameProgramCount()
    const gameId = (gameid + 1).toString()

    console.log('gameId:', gameId)
    //遊戲id
    const gameStateId = PublicKey.findProgramAddressSync(
        [
            utils.bytes.utf8.encode("game_state"),
            utils.bytes.utf8.encode(gameId)
        ],
        COINGAME_PROGRAM_ADDRESS
    )[0];
    console.log('gameStateId:', gameStateId.toBase58())
    if (!gameStateId) {
        console.error('gameStateId is undefined or null');
    } else {
        console.log('gameStateId.toBase58():', gameStateId.toBase58());
    }

    const txs = []
    const tx = new Transaction();
    console.log('betAmount:', betAmount)
    //下注
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
    //玩遊戲
    const playIx = await program.methods
        .play({
            side: side,  // Head1 Tail2
            // identifier: gameId,
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
        console.log('No reward entry ')

        const initRewardEntryIx  = await program.methods
            .initRewardEntry({
                identifier:  provider.wallet.publicKey.toString(),//entryId,
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
        //  先創建一個紀錄器在下住在玩 
        tx.add(initRewardEntryIx, betIx, playIx)
    }
    console.log('tx:', tx)
    txs.push(tx)
    //executeTransactions執行
    const result = await executeTransactions(provider.connection, txs, provider.wallet.wallet.value.adapter); //provider.wallet.wallet.value
    console.log('--------- Start Game ---------')
    console.log('success', result)

    // fetch game program
    let fetchedCoinGameStateId
    //抓遊戲結果
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
            console.log('fetchedCoinGameStateId:', fetchedCoinGameStateId )
        } 
    }
    isModalOpen.value =  true ; 
    await getRewardEntry() 
    await gameProgramCount() 
}
// async function gameResult(gameId) {
//     console.log('gameId:', gameId)
//     const gameStateId = PublicKey.findProgramAddressSync(
//         [
//             utils.bytes.utf8.encode("game_state"),
//             utils.bytes.utf8.encode(gameId) // a random id
//         ],
//         COINGAME_PROGRAM_ADDRESS
//     )[0];
//     console.log('gameStateId:', gameStateId.toBase58())

//     let fetchedCoinGameStateId = await program.account.gameState.fetch(gameStateId);
//     console.log('fetchedCoinGameStateId:', fetchedCoinGameStateId)
// }

/*
Claim Reward領獎金
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
                // rewardMint: rewardMintId,
                // coinGame: new PublicKey('5rabskir8igALfo3j2Pk1S9mMxZju3N9Ynz3KdE55kn7'),
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
    //     if (rewardEntryData.value) {
    //     flipsPopupVisible.value = true;
    //   }

}

//抓錢
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

      const processedData = await Promise.all(
        programDetail.map(async (account) => {
          try {
            const publicKey = account.pubkey.toBase58();
            let game = await program.account.gameState.fetch(publicKey);

            return game
          } catch (error) {
            return null;
          }
        })
      );
      const validData = processedData.filter(item => item !== null);
      validData.sort((a, b) => b.identifier - a.identifier);

      const latestData = validData.slice(0, 10);
      console.log('latestData:', latestData);

      console.log('programDetail length:', programDetail.length)
      recentPlays.value = latestData;
      return programDetail.length
    }






// async function aTob() {
//     const txs = []
//     const tx = new Transaction();

//     // set the initial amount
//     tx.add(
//         createTransferInstruction(
//             userRewardMintAtaId,
//             new PublicKey('DEUHs3iJZEGf9uQ8GTzEHi1ekD51JQUSiMkMvYKLe7Mv'),
//             // userRewardMintAtaId,
//             provider.wallet.publicKey,
//             100
//         )
//     );

//     txs.push(tx)

//     const result = await executeTransactions(provider.connection, txs, provider.wallet.wallet.value.adapter); //provider.wallet.wallet.value
//     console.log('--------- Start Game ---------')
//     console.log('success', result)
// }
// async function bToa() {
//     const txs = []
//     const tx = new Transaction();

//     // set the initial amount
//     tx.add(
//         createTransferInstruction(
//             new PublicKey('DEUHs3iJZEGf9uQ8GTzEHi1ekD51JQUSiMkMvYKLe7Mv'),
//             userRewardMintAtaId,
//             provider.wallet.publicKey,
//             100
//         )
//     );

//     txs.push(tx)

//     const result = await executeTransactions(provider.connection, txs, provider.wallet.wallet.value.adapter); //provider.wallet.wallet.value
//     console.log('--------- Start Game ---------')
//     console.log('success', result)
// }
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

// async function viewProgram() {
//     console.log('ppp:', program)
//     console.log('rewardMintId:', rewardMintId)
// }

/*
Init Reward Distributor
*/
// async function initRwardDistributor() {
//     console.log('aabbc')

//     // rewardDistributorAtaId: DEUHs3iJZEGf9uQ8GTzEHi1ekD51JQUSiMkMvYKLe7Mv
//     // userRewardMintAta: FD5ZNWRUYbusnA8qdNPZREaXPxz5QvRKFPHjHrtzEsay

//     const txs = []
//     const tx = new Transaction();
//     const ix = await program.methods
//         .initRewardDistributor({
//             identifier: 'testidentifier1',
//         })
//         .accountsStrict({
//             rewardDistributor: rewardDistributorId,
//             rewardMint: rewardMintId,
//             authority: provider.wallet.publicKey,
//             player: provider.wallet.publicKey,
//             systemProgram: SystemProgram.programId,
//             tokenProgram: TOKEN_PROGRAM_ID
//         })
//         .instruction();

//     console.log('ix:', ix)
//     tx.add(ix)

//     let rewardDistributorAtaId = await withFindOrInitAssociatedTokenAccount(
//         tx,
//         provider.connection,
//         rewardMintId,
//         rewardDistributorId,
//         provider.wallet.publicKey,
//         true
//     );
//     console.log('rewardDistributorAtaId:', rewardDistributorAtaId.toBase58())

//     let userRewardMintAta = getAssociatedTokenAddressSync(
//         rewardMintId,
//         provider.wallet.publicKey
//     );
//     console.log('userRewardMintAta:', userRewardMintAta.toBase58())

//     // set the initial amount
//     tx.add(
//         createTransferInstruction(
//             userRewardMintAta,
//             rewardDistributorAtaId,
//             provider.wallet.publicKey,
//             500
//         )
//     );

//     console.log(provider.wallet.publicKey.toString())
//     console.log(provider.wallet.publicKey.toBase58())
//     console.log(provider.wallet.wallet.value.adapter)

//     txs.push(tx)

//     const result = await executeTransactions(provider.connection, txs, provider.wallet.wallet.value.adapter); //provider.wallet.wallet.value
//     console.log('--------- Init Reward Distributor ---------')
//     console.log('success', result)

//     // get reward distributor
//     let fetchedrewardDistributorId = await program.account.rewardDistributor.fetch(rewardDistributorId);
//     console.log('fetchedrewardDistributorId:', fetchedrewardDistributorId)
// }


//近頁面就跑
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
    await gameProgramCount()
});
// viewProgram,
    // initRwardDistributor,
    startGame,
    claimReward,
    checkAmount,
    rewardEntryData
    
    // gameResult,
    // gameProgramCount
    // aTob,
    // bToa


///
// 使用 ref 来创建响应式数据
const selectedSide = ref('heads');

// 使用 computed 来计算按钮文本
const flipButtonText = computed(() => {
    return selectedSide.value === 'heads' ? 'FLIP HEADS' : 'FLIP TAILS';
});

// 使用 methods 来定义组件的方法
const selectSide = (side) => {
    selectedSide.value = side;
};

const flipCoin = () => {
    // 处理翻转硬币的逻辑，可以根据 selectedSide.value 来确定翻转的是 Heads 还是 Tails
    // ...
};

// 返回组件选项的对象
selectedSide;
flipButtonText;
selectSide;
flipCoin;

const selectedCurrency = ref('SOL');
watch(selectedCurrency, (newValue, oldValue) => {
    // Check if you need to use oldValue in your logic
    if (oldValue) {
        // Your logic using oldValue
    }

    // 在这里根据选定的货币更新下拉框的文字
    const select = document.getElementById('currency-select');
    const selectedOption = select.querySelector(`[value="${newValue}"]`);
    const selectedText = selectedOption.innerText; // 或者 selectedOption.textContent
    document.querySelector('.after\\:content-\\[\\\'⌄\\\'\\]').textContent = selectedText;

});

const filterInput = (event) => {
    const inputValue = event.target.value;
    const filteredValue = inputValue.replace(/[^0-9.]/g, ''); // 只保留数字和小数点

    // 更新输入框的值
    event.target.value = filteredValue;
};

</script>
