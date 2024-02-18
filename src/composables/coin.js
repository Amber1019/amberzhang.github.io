// import { watch }  from 'vue'; 
import { useWallet } from 'solana-wallets-vue'
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
    ref,
    computed,
    inject
} from 'vue';
import {
    executeTransactions, 
    // withFindOrInitAssociatedTokenAccount
} from "@cardinal/common"; 

export const isHeads = ref(true);
export const isFlipping = ref(false);
export const recentPlays = ref([]);
export const isModalOpen = ref(false); 
export const closeModal = () => { 
isModalOpen.value = false;
};
export const selectedSide = ref('heads');
export const selectSide = (side) => {
selectedSide.value = side;
};
export const flipButtonText = computed(() => {
return selectedSide.value === 'heads' ? 'FLIP HEADS' : 'FLIP TAILS';
});
const flipCoinss = () => {
    if (!isFlipping.value) { 
        isFlipping.value = true;
        setTimeout(() => {
        isHeads.value = !isHeads.value;
        isFlipping.value = false;
        }, 2000);
        }   
    };
// export async function coin() {
//     const wallet = useWallet(); 
//     // console.log('wallet' ,wallet)
//     const computedWalletAddress = computed(() => wallet.publicKey.value);   

//     // 使用 watch 監視 computedWalletAddress
//     watch(computedWalletAddress, async (newVal) => {
//     console.log('walletAddress 變化了：', newVal);

//     if (newVal != null) {
//         await setUp()
//         console.log("Player Publickey:", wallet.publicKey.toString())
//         await findAccountAndAddress()
//         await findProgram()
//         console.log('------------- Hello player. -------------')
//         await getRewardEntry()
//         await gameProgramCount()
//     }
//     });
// }

const anchor = require('@project-serum/anchor');
// let wallet 
// let connection
// let provider
//COINGAME的專屬地址
const COINGAME_PROGRAM_ADDRESS = new PublicKey("7m69C1L22UGQs4NBiyDaPvVz6WRiXKTiPTt1im2hr3Fw")
const cryptojs = inject('cryptojs') 
console.log('cryptojs', cryptojs ) 

export async function setUp() { 
    let connection
    let provider
    let wallet = useWallet(); 
    console.log('connecting wallet......')
    console.log('wallet' ,wallet)
    // wallet = useWallet();
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
    return {
        connection,
        provider,
        // wallet
    }
}

export async function findProgram() {
    let idl //F6YzUPirXo8UBX8Z5YcLicryVEuJKmhqvsYG3dTPBXUL
    let program;
    const {provider} = await setUp();
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
    return{
        idl,
        program
    }
}

export async function findAccountAndAddress() {
    //Mint傳送
    let userRewardMintAtaId
    //new PublicKey 是把字串轉為bn法
    let rewardMintId = new PublicKey('2inV5JYpdUc5MAgqY6tWx11Bm3694PDm3GmjFLpN4tfz') //錢幣的地址
    // let entryId = 'user2' //'user1' // id should be user's address (provider.wallet.publicKey.toString())
    let rewardEntryId
    let rewardDistributorId
    const {provider} = await setUp();
    //用錢幣地址跟用戶地址找ata(AssociatedTokenAddress)用來transfer錢幣
    userRewardMintAtaId = getAssociatedTokenAddressSync(
        rewardMintId,
        provider.wallet.publicKey
    );
    console.log('userRewardMintAtaId:', userRewardMintAtaId.toBase58())
    
    //每一個用戶專屬的紀錄器的id
    let address = provider.wallet.publicKey.toString()
    console.log('address:', address)
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
    return {
        userRewardMintAtaId,
        rewardMintId,
        rewardEntryId,
        rewardDistributorId

    }
}

export async function getRewardEntry() {
    let rewardEntryData = ref()
    const {program} = await findProgram();
    const {rewardEntryId} = await findAccountAndAddress();
    try {
        rewardEntryData.value = await program.account.rewardEntry.fetch(rewardEntryId);
        // console.log('Already have reward entry:', rewardEntryData.value);
        console.log('rewardAmount:', rewardEntryData.value.rewardAmount.toString());
    } catch (error) {
        rewardEntryData.value = null;
        
    }
    return{
        rewardEntryData
    }
}

export async function startGame(side, betAmount) { //, gameId
    const {program} = await findProgram();
    const {rewardEntryId,rewardDistributorId,rewardMintId,userRewardMintAtaId} = await findAccountAndAddress();
    const {provider} = await setUp();
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
        await flipCoinss();
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
    const flipCoins = async (fetchedCoinGameStateId) => {
        console.log(fetchedCoinGameStateId) 
        // console.log(fetchedCoinGameStateId.gameResult) 
    if (!isFlipping.value) {
        isFlipping.value = true;
        await new Promise(resolve => { 
        setTimeout(() => {
            if (fetchedCoinGameStateId.gameResult == true) {
            // 如果 gameResult 是 true，翻转到 selectSide 函数所选的那一边
            isHeads.value = selectedSide.value; 
            } else {
            // 如果 gameResult 是 false，翻转到相反的一边
            isHeads.value = !selectedSide.value;
            }
            isFlipping.value = false;
            resolve();
        }, 2000);
        });
    }
    };
    await flipCoins( fetchedCoinGameStateId)
    await flipCoins( fetchedCoinGameStateId.gameResult);
    isModalOpen.value =  true ; 
    await getRewardEntry() 
    await gameProgramCount() 

}


export async function claimReward() {
    const {program} = await findProgram();
    const {rewardEntryId,rewardDistributorId,userRewardMintAtaId} = await findAccountAndAddress();
    const {rewardEntryData} = await getRewardEntry();
    const {provider} = await setUp();
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
}

export async function checkAmount() {
    const {userRewardMintAtaId} = await findAccountAndAddress();
    const {provider} = await setUp();
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

export async function gameProgramCount() {
    const {program} = await findProgram();
    const {connection} = await setUp();
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