import request from 'request';
import userAgents from './common/userAgent.js';
import Promise from 'bluebird';
import cheerio from 'cheerio';//类似jquery写法
import fs from 'fs';
const  Iconv = require('iconv').Iconv;

const iconv = new Iconv('GBK', 'UTF-8');

const URL = 'http://www.qb5200.org/xiaoshuo/62/62493/';
let pageUrl = `${URL}6161384.html`; //章节存放变量，初始化是第一章地址
//这里只做测试，所以用变量存，而实际应用中，应该使用数据缓存
const expiryTime = 5 * 60 * 1000;// 过期间隔时间，毫秒
let ips = null; //代理ip
let time = null;// 存储代理IP的时间，判断是否过期，如果过期重新请求
let pageNumber = 1; //页码
//let info = '';//爬取到的内容存放变量
/**
 * 请求免费代理，可做缓存，这里就存在变量中，只做测试
 */
const getProxyList = () => {
    return new Promise((resolve, reject) => {
    		const nowDate = Date.now();
    		if( nowDate - time <  expiryTime ){
    			resolve(ips);
    			return;
    		}
    		const apiURL = 'http://www.66ip.cn/mo.php?sxb=&tqsl=100&port=&export=&ktip=&sxa=&submit=%CC%E1++%C8%A1&textarea=http%3A%2F%2Fwww.66ip.cn%2F%3Fsxb%3D%26tqsl%3D100%26ports%255B%255D2%3D%26ktip%3D%26sxa%3D%26radio%3Dradio%26submit%3D%25CC%25E1%2B%2B%25C8%25A1';
        const options = { method: 'GET', url: apiURL, gzip: true, encoding: null,
            headers: {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Encoding': 'gzip, deflate',
                'Accept-Language': 'zh-CN,zh;q=0.8,en;q=0.6,zh-TW;q=0.4',
                'User-Agent': 'Mozilla/8.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/45.0.2454.101 Safari/537.36',
                'referer': 'http://www.66ip.cn/'
            },
        };
        request(options, (error, response, body)=>{
            try {
            	 	if(Buffer.isBuffer(body)){
            	 		const ret = body.toString().match(/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d{1,4}/g);
            	 		ips = ret;
            	 		time = Date.now();
            	 		resolve(ret);
            	 	}
            } catch (e) {
                  console.log(e);
            }
        });
    })
}
//爬取小说
async function getPageIndex(ipList,url){
	return new Promise((resolve, reject) => {
		let userAgent = userAgents[parseInt(Math.random() * userAgents.length)];
	    let ip = ipList[parseInt(Math.random() * ips.length)];
	    let useIp = `http://${ip}`;const options = { method: 'GET', url: url, gzip: true, encoding: null,
	        headers: {
	            'User-Agent': userAgent, //动态设置浏览器头部信息
	        },
	        proxy: useIp, //动态设置代理ip
	        timeout: 8000
	    };
	    request( options , (error, response, body)=>{
	    		//429 Too Many Requests 这个问题貌似是服务器问题
	         if (error || body.toString().indexOf('429 Too Many Requests') >= 0 ) {
	            console.log(`爬取页面失败，${error}，正在重新寻找代理ip... ×`);
	            resolve(undefined);
	            return;
	          }else{
	 			console.log('爬取页面成功，  √');
			}
	        resolve(body)
	    })
	})	
}
//获取内容
async function getChapter(body){
	return new Promise((resolve, reject) => {
		let result = iconv.convert(new Buffer(body, 'binary')).toString();
		let $ = cheerio.load(result);
		let title = $('#title').text();
		title = `第${pageNumber}章 ${title}`;
		let content = $('#content').text();
		let list = $('#footlink>a');
		console.log(title);
		//这里是因为有时候拿不到下一页的按钮，就自己退出了，所以做下处理
		if(list.length === 0){
			resolve(undefined);
			return;
		}
		list.each(function(i,item){
			let $this = $(this);
			if($this.text() === '下一页'){
				let path = $this.attr('href');
				if( path.indexOf('http') >= 0 ){
					path = null;
				}else{
					path = URL + path ;
				}
				resolve({
					content: `${title}\n ${content}\n\n\n\n`,
					path: path
				});
			}
		})
		
	})
}
//写入到本地
async function Write(info){
	return new Promise((resolve, reject) => {
		const decodedText = new Buffer(info);
		fs.readFile('九天剑道.txt',function(err,_buffer){
			if(err){//读取失败，则直接创建
				fs.writeFile('九天剑道.txt',decodedText,function(err){
					if(err){
						console.log(err);
					}else{
						console.log('写入成功---!');
						resolve(true);
					}
				})
			}
			if(Buffer.isBuffer(_buffer)){//判断是否是Buffer对象
				fs.writeFile('九天剑道.txt',new Buffer(_buffer.toString() + info),function(err){
					if(err){
						console.log(err);
					}else{
						console.log('写入成功!');
						resolve(true);
					}
				})
			}
		})
		
	});
}
//启动方法
async function startFun(){
	const ipList = await getProxyList();//获取代理ip
	const body = await getPageIndex( ipList, pageUrl );//爬取主页面
	if(!body){
		startFun();
		return;
	}
	const item = await getChapter(body);//获取爬到的内容
	if(!item){
		startFun();
		return;
	}
	const info = item.content;
	//判断是否有下一页，全部爬完之后写入到本地，生产文件
	//如果章节过多，应该加上一点处理方式，这里不赘述，我想应该是这样的
	if(item.path){
//		if(pageNumber%2===0){
		const isWrite =  await Write(info);
//			info = '';
//		}
		pageNumber++;
		pageUrl = item.path;
		startFun();
	}
}
//启动方法
startFun();




