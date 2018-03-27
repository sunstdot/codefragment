/**
 * 该代码根据promiseA+规范实现
 * promise具备一下三种状态： 等待态（pending）、执行态（Filfilled）和拒绝态（rejected），
 * 一旦Promise 被resolve或reject，不能再迁移到其他任何状态（即状态immutable）
 * 只有异步操作的结果可以改变 这个状态
 */

 class Promise {
    constructor(fn) {
        //0 - pending
        //1 - resolved
        //2 - rejected
        this._state = 0;
        
        //promise执行结果
        this._value = null;
        
        //then注册的回调处理数组
        this._deferreds = [];

        this.catchFn = null;

        //立即执行 fn 函数
        try {
            fn(value => {
                //异步操作成功执行resolve
                this.resolve(this, value);
            }, reason => {
                this.reject(this, reason);
            })
        } catch (err) {
            this.reject(this, err);
        }
    }
    //A+ duckcheck 主要参考PromiseA+规范
    //resolve的主要作用是，将promise对象的状态“未完成” 变为“成功” （即从pending变为resolved）
    //在异步操作成功时调用，并将异步操作的结果做为参数传递出去
    resolve(promise, value) {
        //非pending状态不可变
        if(promise._state !== 0) {
            return;
        }
        console.log('执行resolve操作');
        //promiseA+规范2.3.1
        if(value === promise) {
            return this.reject(promise, new TypeError('A promise cannot be resolved with itself.'))
        }
        if(value && value instanceof Promise && value.then === promise.then) {
            let deferreds = promise._deferreds;

            if(value._state === 0) {
                //value 为pending状态
                //将promise._deferreds 传递个value._deferreds
                value._deferreds.push(...deferreds);
            }else if(deferreds.length !== 0){
                for(let i = 0; i < deferreds.length; i++) {
                    this.handleResolved(value, deferreds[i]);
                }
                //清空then注册回调处理数组
                value._deferreds = [];
            }

            
            return;
        }
        //value是对象或者函数
        if(value && (typeof value === 'object' || typeof value === 'function')) {
            let then;
            try {
                then = value.then;
            } catch(err) {
                return this.reject(promise, err);
            }
            //如果then 是函数，将value做为函数的作用域this 调用之
            if(typeof then === 'function') {
                try {
                    //执行then函数
                    then.call(value, function(value) {
                        this.resolve(value)
                    }, function(reason) {
                        this.reject(promise, reason);
                    })
                } catch(err) {
                    this.reject(promise, err);
                }
                return;
            }
        }

        //改变promise 内部状态 `resolved`
        promise._state = 1;
        promise._value = value;

        //promise 存在then 注册回调函数
        if (promise._deferreds.length !== 0) {
            for(let i = 0; i<promise._deferreds.length;i++) {
                this.handleResolved(promise, promise._deferreds[i]);
            }

            //清空then注册回调处理函数
            promise._deferreds = [];
        }
    }
    //reject 函数的作用是，将 primise对象的状态从“未完成”变成“失败”（即从pending变成rejected）
    //在异步操作失败时调用，并将异步操作报出的错误，做为参数传递出去
    reject(promise, reason) {
        //非pending状态不可变
        if(promise._state !== 0) return;
        console.log('执行reject');
        //改变promise 内部状态为 `rejected`
        promise._state = 2;
        promise._value = reason;
        if(promise._deferreds.length !== 0) {
            //异步执行回调函数
            for(let i = 0; i<promise._deferreds.length; i++) {
                this.handleResolved(promise, promise._deferreds[i]);
            }
        }
    }
    /**
     * Promise A+ 规范专注于提供通用的then方法。 then方法 可以被同一个promise调用多次，
     * 每次返回新的promise对象。 then方法接受两个参数 onResolved、 onRejected (可选)，
     * 第一个回调函数是Promise对象变成resolved时调用， 第二个回调函数是Promise 对象的状态变为rejected时调用。
     * 在promise被resolve或reject后， 所有onResolved或onRejected函数按照其注册顺序依次回调，且调用次数不超过一次
     */
    //Promise 实例生成后，可以用then方法分别指定resolved 状态和 rejected状态的回调函数！！！
    then(onResolved, onRejected) {
        console.log('注册then回调处理')
        let res = new Promise(function() {});
        let deferred = this.handler(onResolved, onRejected, res);

        //当前状态为pending时，存储延迟处理对象
        if(this._state === 0) {
            this._deferreds.push(deferred);
            return res;
        }

        //当前promise 状态不为pending
        //异步调用handleResolved 执行 onResolved 或 onRejected回调
        this.handleResolved(this, deferred);

        //返回promise新对象维持链式调用
        return res;
    }

    catch(onRejected) {
        return this.then(null, onRejected);
    }

    //todo 
    //回调是同步就同步执行，回调是异步就异步执行，then中获取
    try() {

    }
    //all 所有的状态都resolved 了才会resolved
    all() {

    }
    //只要有一个状态为resolve就执行
    race() {

    }

    handler(onResolved, onRejected, promise) {
        return {
            onResolved: typeof onResolved === 'function' ? onResolved : null,
            onRejected: typeof onRejected === 'function' ? onRejected : null,
            promise
        };
    }
    //之所以要异步执行，是为了保证你如果promise对象的状态不受外部影响
    handleResolved(promise, deferred) {
        this.asyncFn()(() => {
            let cb = promise._state === 1 ? deferred.onResolved : deferred.onRejected;

            //传递注册回调函数为空的情况
            if(cb === null) {
                if(promise._state === 1) {
                    this.resolve(deferred.promise, promise._value);
                } else {
                    this.reject(deferred.promise, promise._value);
                }
                return;
            }
            let res;
            //执行注册回调操作
            try {
                res = cb(promise._value);
            } catch(err) {
                this.reject(deferred.promise, err);
            }

            //c处理链式 then(...) 注册处理函数调用
            this.resolve(deferred.promise, res);
        });
    }

    asyncFn() {
        if(typeof process === 'object' && process !== null && typeof(process.nextTick) === 'function') {
            return process.nextTick;
        } else if(typeof(setImmediate) === 'function') {
            return setImmediate;
        }
        return setTimeout;
    }
 }


//******************************************************example1*******************************************************
const fs = require('fs');

// let testcase = function() {
//     let promise = new Promise(function(resolve, reject) {
//         console.log('立即执行promise实例化函数');
//         fs.readFile('./test.txt', (err, data) => {
//             console.log('已经执行完毕异步函数');
//             if(err) reject(err);
//             resolve(data);
//         })
//     });
//     promise.then(function(data) {
//         console.log(data+"========1");
//     }).then(function(data) {
//         console.log(data+"========2");
//     })
// };

// testcase();


//******************************************************example2*******************************************************
/**
 * timeout 方法返回一个Promise实例，表示过一段时间以后才会发生的结果。过了指定的时间(ms参数)以后，
 * Promise实例的状态变成resolved， 就会触发then方法绑定的回调函数
 * @param {any} ms 
 * @returns 
 */
// function timeout(ms) {
//     return new Promise((resolve, reject) => {
//         console.log('Promise---');  //立即执行
//         setTimeout(resolve, ms, 'done');
//     });
// }
// timeout(100).then(value => {
//     console.log('resolved');
// });
// console.log('Hi====');
//Promise----
//Hi====
//resolved


//******************************************************example3*******************************************************
// const p1 = new Promise(function(resolve, reject) {
//     setTimeout(() => reject(new Error('fail')), 3000);
// });

// const p2 = new Promise(function(resolve, reject) {
//     setTimeout(() => resolve(p1), 1000);
// });

// p2
//   .then(result => console.log(result+"======3"))
//   .catch(function(err) {
//     console.log(err+"======4")
//   })

//Error: fail

//上面的代码中，P1 是一个promise ，3s后变为rejected状态。 P2状态在1秒后改变， resolve方法返回的是p1。
//由于p2又返回了一个Promise，导致P2自己的状态无效了， 由p1 决定p2的状态。所以后面的then语句都是针对后者（p1）。
//又过了2秒， p1变成rejected， 导致触发catch方法指定的回调函数

//******************************************************example4*******************************************************

//写法一
const promise = new Promise(function(resolve, reject) {
    try {
        throw new Error('test');
    } catch(err) {
        reject(err);
    }
})
promise.catch(function(err) {
    console.log(err);
})

//写法二
const promise1 = new Promise(function(resolve, reject) {
    reject(new Error('test'));
})
promise1.catch(function(err) {
    console.log(err);
})

//两种写法等价，reject方法的作用就等于抛错误。 but 如果Promise的状态已经变成resolved，再抛出错误是无效的
//promise对象的错误具有“冒泡”性质，会一直向后传递，知道被捕获为止。即 错误总是会被下一个catch语句捕获
//写法三
const promise2 = new Promise(function(resolve, reject) {
    resolve('ok');
    throw new Error('test');
})
promise2
    .then(function(value) {
        console.log(value)
    })
    .catch(function(err) {
        console.log(err);
    })

//跟传统的try/catch不同的是，如果没有使用catch方法指定错误处理的回调函数，Promise对象抛出的错误不会传递到外层代码，即不会有反应
const someAsyncThing = function() {
    return new Promise(function(resolve, reject) {
        //会报错，因为x未声明
        resolve(x+2);
    })
}
someAsyncThing().then(function() {
    console.log('everything is ok')
});

// setTimeout(() => {console.log(123)}, 2000);
// Uncaught (in promise) ReferenceError: x is not defined
// 123

//上面代码中，someAsyncThing函数产生的 Promise 对象，内部有语法错误。
//浏览器运行到这一行，会打印出错误提示ReferenceError: x is not defined，但是不会退出进程、终止脚本执行，2 秒之后还是会输出123。
//这就是说，Promise 内部的错误不会影响到 Promise 外部的代码，通俗的说法就是“Promise 会吃掉错误”。

