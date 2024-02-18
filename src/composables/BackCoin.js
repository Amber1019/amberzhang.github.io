import { ref,watch } from 'vue';

// 使用 ref 創建反應式數據
export const flipsPopupVisible = ref(false);
// 顯示 Your Flips 彈跳視窗函數
export const showFlipsPopup = () => {
    flipsPopupVisible.value = true;
}
// 關閉 Your Flips 彈跳視窗函數
export const closeFlipsPopup = () => {
    flipsPopupVisible.value = false ;
};
export const selectedCurrency = ref('SOL'); 
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
export const filterInput = (event) => {
        const inputValue = event.target.value;
        const filteredValue = inputValue.replace(/[^0-9.]/g, ''); // 只保留数字和小数点
        // 更新输入框的值
        event.target.value = filteredValue;
    };



