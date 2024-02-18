<template>
  <div>
    <!-- <WalletButton msg="The Multi Button"/> -->
    <!-- <CoinGame msg="Welcome to Your Vue.js App" /> -->
    <MainWorld msg="Welcome to Your Vue.js App" />
    <!-- <ShowPopup></ShowPopup> -->
    <!-- <YourFlip></YourFlip> -->
  </div>
</template>

<script>
// import WalletButton from './components/WalletButton.vue';
import MainWorld from './components/MainWorld.vue';
// import ShowPopup from "./components/ShowPopup.vue";
// import CoinGame from './components/CoinGame.vue'
import {
  PhantomWalletAdapter
} from '@solana/wallet-adapter-wallets';
import { initWallet } from 'solana-wallets-vue';
// // import YourFlip from './components/YourFlip.vue';
export default {
  name: 'App',
  components: { 
    MainWorld
  },
  setup() {
    
    console.log ('Initializing wallet...');

    // 初始化 Solana 錢包
    const walletOptions = {
      wallets: [
        new PhantomWalletAdapter()
      ],
      autoConnect: true,
    };
    const wallet = initWallet(walletOptions);
    
    // 返回在模板中使用的變數和函數
    return {
      wallet
    };
    
  }
}

</script>

<style>
/* #app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 60px;
} */
</style>
