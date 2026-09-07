---
title: "快速排序"
section: 高级排序
icon: zap
---

### 常规写法

```js
// 老袁讲义版quickSort
var quickSort = function (arr) {
    if (arr.length <= 1) {
        return arr;
    }
    let curIndex = Math.floor(arr.length / 2);
    let cur = arr.splice(curIndex, 1)[0];
    let left = [], right = [];
    for (let i = 0; i < arr.length; i++) {
        if (arr[i] < cur) {
            left.push(arr[i])
        } else {
            right.push(arr[i])
        }
    }
    return quickSort(left).concat(cur, quickSort(right))
};
// 双指针版
var sortArray = function (arr, left = 0, right = arr.length - 1) {
    if (left >= right) { //左边比右边大说明区间里没有数据了
        return arr;
    }

    const pivot = arr[left];
    let i = left + 1;
    let j = right;

    while (i <= j) { // 判断条件全包含 i<=j，四次
        while (i <= j && arr[i] < pivot) { //左边要找比pivot大的，所以只要小于pivot就一直i++
            i++;
        }
        while (i <= j && arr[j] > pivot) { //右边要找比pivot小的，所以只要小于pivot就一直j--
            j--;
        }
        if (i <= j) { //和顶部条件保持一致 这里没特别意义，只是防止i j超出条件，因为上边两个while也会操作i j
            [arr[i], arr[j]] = [arr[j], arr[i]];
            //能通过上边两个while循环走到这里，说明是满足要求的两个数 可以互换一下 然后继续比较
            i++;
            j--;
        }
    }

    [arr[left], arr[j]] = [arr[j], arr[left]]; //新找到的pivot和旧的pivot要置换一下

    sortArray(arr, left, j - 1);//处理j-1左边的
    sortArray(arr, j + 1, right)//处理j+1右边的
    return arr;
};



let arr = [12, 3, 4, 11, 57, 112, 13];
console.log(quickSort(arr));
```

### 原地版

```ts
// 快排(原地版)
function findKthLargest(nums: number[], k: number): number {
	quickSort(nums, 0, nums.length - 1); // 把整个数组排好序(从小到大)
	return nums[nums.length - k]; // 排序后,第k大的元素,就是"倒数第k个"
}

function quickSort(nums: number[], l: number, r: number): void {
	if (l >= r) return; // 区间只剩0或1个元素,不用再排了

	let pivot = nums[r]; // 选最右边的元素作为基准值
	let i = l - 1; // i指向"已确定小于pivot的区域"的最后一个位置

	for (let j = l; j < r; j++) {
		if (nums[j] < pivot) {
			i++;
			[nums[i], nums[j]] = [nums[j], nums[i]]; // 把小于pivot的元素往左边挪
		}
	}

	[nums[i + 1], nums[r]] = [nums[r], nums[i + 1]]; // 把pivot放到它最终该在的位置
	let pivotIndex = i + 1;

	quickSort(nums, l, pivotIndex - 1); // 递归排左边
	quickSort(nums, pivotIndex + 1, r); // 递归排右边
}
```

### 逐行注释版

```ts
// 快速排序的主要递归函数
// q: 要排序的数组
// l: 当前处理区间的左边界
// r: 当前处理区间的右边界
function quick_sort(q: number[], l: number, r: number): void {
    // 如果左边界大于等于右边界，说明当前区间长度小于等于1，已经有序，直接返回
    if (l >= r) return;
    
    // i从左边界往右扫描，初始在左边界左侧一位
    let i: number = l - 1;
    // j从右边界往左扫描，初始在右边界右侧一位
    let j: number = r + 1;
    // 选择区间中点的值作为基准值（pivot）
    // 使用位运算 >> 1 代替除以2，可以提高性能
    // Math.floor确保得到整数结果
    const x: number = q[Math.floor((l + r) >> 1)];
    
    // 当i和j没有相遇时，继续进行分区操作
    while (i < j) {
        // 找到左边第一个大于等于基准值的位置
        do {
            i++;
        } while (q[i] < x);
        
        // 找到右边第一个小于等于基准值的位置
        do {
            j--;
        } while (q[j] > x);
        
        // 如果i还在j的左边，说明找到了一对需要交换的元素
        if (i < j) {
            // 使用ES6的解构赋值语法交换两个元素
            // 这样写比用临时变量交换更简洁
            [q[i], q[j]] = [q[j], q[i]];
        }
    }
    
    // 递归处理左半区间
    // j位置的元素已经在正确的位置上了
    quick_sort(q, l, j);
    // 递归处理右半区间
    quick_sort(q, j + 1, r);
}

// 对外暴露的排序函数接口
// nums: 需要排序的数组
// 返回值: 排序后的数组（原地排序，返回原数组）
function sortArray(nums: number[]): number[] {
    // 调用快速排序函数，传入整个数组区间
    quick_sort(nums, 0, nums.length - 1);
    // 返回排序后的数组
    return nums;
}

// 测试用例
// const nums = [5, 2, 3, 1];
// console.log(sortArray(nums)); // 输出: [1, 2, 3, 5]

/*
快速排序的核心思想：
1. 选择一个基准值（pivot）
2. 将数组分成两部分：小于基准值的元素和大于基准值的元素
3. 递归地对这两部分进行排序

时间复杂度分析：
- 平均情况：O(n log n)
- 最坏情况：O(n²)，当数组已经有序或逆序时
- 最好情况：O(n log n)

空间复杂度：
- O(log n)，主要是递归调用栈的空间

优化思路：
1. 基准值的选择可以使用三数取中法
2. 对于小规模子数组可以使用插入排序
3. 处理重复元素时可以使用三路快排
*/
```
