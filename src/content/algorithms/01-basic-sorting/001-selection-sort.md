---
title: "选择排序"
section: 基础排序
icon: arrow-down-narrow-wide
---

```ts
// 912. 排序数组 选择排序版
function sortArray(nums: number[]): number[] {
    const len = nums.length - 1;
    for (let i = 0; i < len; i++) {  //选择排序不需要比较最后一个元素,所以< len
        let minIndex = i;
        for (let j = i + 1; j <= len; j++) {
            if (nums[j] < nums[minIndex]) {
                minIndex = j;
            }
        }
        if (minIndex !== i) { //内循环里判断最小值的索引是否改变
            swap(nums, minIndex, i);
        }
    }
    return nums;
};

function swap(arr: number[], indexA: number, indexB: number) {
    [arr[indexA], arr[indexB]] = [arr[indexB], arr[indexA]]; //解构赋值简化操作
}

// 选择排序思路：假设i位置是第一个最小值，然后从i+1开始找到最小值的索引，然后交换i和最小值的索引的值
// 选择排序是不稳定的排序算法，因为在交换的时候可能会改变相同元素的相对位置
```
