//Peerモデルを定義
const Peer = window.Peer;
var canvas = document.getElementById('overlay');
var context = canvas.getContext('2d');
var isTracking = false;
var ctracker = new clm.tracker({ searchWindow: 15, stopOnConvergence: true });
ctracker.init(pModel);

var countface = 0;
var faceparaOFF = 350;
var faceparaON = 0;

var continue_h = 0;
var continue_s = 0;
var continue_on = 0;
var continue_off = 0;

var hcount = 0;
var scount = 0;
var oncount = 0;
var offcount = 0;
//顔情報データ集計用配列
var maindata = [];
var maindata_temp = [];
var flag_onoff=0;
var offresult=0;

function Count(_date1, _name, _status) {
  this.date1 = _date1;
  this.name = _name;
  this.status = _status;
}



(async function main() {
  //操作がDOMを取得
  var localVideo = document.getElementById('js-local-stream');
  const joinTrigger = document.getElementById('js-join-trigger');
  const leaveTrigger = document.getElementById('js-leave-trigger');
  const micTrigger = document.getElementById('js-mic-trigger');
  const videoTrigger = document.getElementById('js-video-trigger');
  const shareTrigger = document.getElementById('js-shere-trigger');
  const remoteVideos = document.getElementById('js-remote-streams');
  const roomId = document.getElementById('js-room-id');
  const roomMode = document.getElementById('js-room-mode');
  const localText = document.getElementById('js-local-text');
  const localName = document.getElementById('js-local-name');
  const sendTrigger = document.getElementById('js-send-trigger');
  const messages = document.getElementById('js-messages');
  const button1 = document.getElementById('button1');

  const meta = document.getElementById('js-meta');
  const sdkSrc = document.querySelector('script[src*=skyway]');
  const checktrigger = document.getElementById('js-check-trigger');
  var mic = true;
  var video = true;

  var message_object = [];//メッセージ送信用のオブジェクト
  meta.innerText = `
    UA: ${navigator.userAgent}
    SDK: ${sdkSrc ? sdkSrc.src : 'unknown'}
  `.trim();

  //同時接続モードがSFUなのかMESHなのかをここで設定
  const getRoomModeByHash = () => (location.hash === '#sfu' ? 'sfu' : 'mesh');
  //divタグに接続モードを挿入
  roomMode.textContent = getRoomModeByHash();
  //接続モードの変更を感知するリスナーを設置
  window.addEventListener(
    'hashchange',
    () => (roomMode.textContent = getRoomModeByHash())
  );

  //自分の動画系はここ！！
  //自分の映像と音声をlocalStreamに代入
  var localStream = await navigator.mediaDevices
    .getUserMedia({
      audio: true,
      video: true,
    })
    .catch(console.error);

  var emotionClassifier = function () {
    var previousParameters = [];
    var classifier = {};
    var emotions = [];
    var coefficient_length;

    this.getEmotions = function () {
      return emotions;
    }

    this.init = function (model) {
      // load it
      for (var m in model) {
        emotions.push(m);
        classifier[m] = {};
        classifier[m]['bias'] = model[m]['bias'];
        classifier[m]['coefficients'] = model[m]['coefficients'];
      }
      coefficient_length = classifier[emotions[0]]['coefficients'].length;
    }

    this.getBlank = function () {
      var prediction = [];
      for (var j = 0; j < emotions.length; j++) {
        prediction[j] = { "emotion": emotions[j], "value": 0.0 };
      }
      return prediction;
    }

    this.predict = function (parameters) {
      var prediction = [];
      for (var j = 0; j < emotions.length; j++) {
        var e = emotions[j];
        var score = classifier[e].bias;
        for (var i = 0; i < coefficient_length; i++) {
          score += classifier[e].coefficients[i] * parameters[i + 6];
        }
        prediction[j] = { "emotion": e, "value": 0.0 };
        prediction[j]['value'] = 1.0 / (1.0 + Math.exp(-score));
      }
      return prediction;
    }

    this.meanPredict = function (parameters) {
      // store to array of 10 previous parameters
      previousParameters.splice(0, previousParameters.length == 10 ? 1 : 0);
      previousParameters.push(parameters.slice(0));

      if (previousParameters.length > 9) {
        // calculate mean of parameters?
        var meanParameters = [];
        for (var i = 0; i < parameters.length; i++) {
          meanParameters[i] = 0;
        }
        for (var i = 0; i < previousParameters.length; i++) {
          for (var j = 0; j < parameters.length; j++) {
            meanParameters[j] += previousParameters[i][j];
          }
        }
        for (var i = 0; i < parameters.length; i++) {
          meanParameters[i] /= 10;
        }

        // calculate logistic regression
        return this.predict(meanParameters);
      } else {
        return false;
      }
    }
  }
  // localStreamをdiv(localVideo)に挿入
  localVideo.srcObject = localStream;
  var EClassifier = new emotionClassifier();
  EClassifier.init(emotionModel);

  localVideo.playsInline = true;
  await localVideo.play(console.log("play")).catch(console.error);
  // await ctracker.start(localVideo);
  localVideo.muted = true;

  //ビデオ・マイクをデフォルトでoffにする
  localStream.getVideoTracks().forEach((video) => (video.enabled = false));
  localStream.getAudioTracks().forEach((track) => (track.enabled = false));
  //自分の動画系はここ！！まで！！！！！だけ！！！！！！
  // Peerのインスタンス作成
  const peer = (window.peer = new Peer({
    key: window.__SKYWAY_KEY__,
    debug: 3,
  }));
  // 解析データをダウンロード
  function button1_clicked(evt) {
    evt.preventDefault();
    const blob = new Blob([JSON.stringify(maindata, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    document.body.appendChild(a);
    a.download = 'foo.txt';
    a.href = url;
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }
  // 「div(joinTrigger)が押される＆既に接続が始まっていなかったら接続」するリスナー設置
  joinTrigger.addEventListener('click', () => {
    if (!peer.open) {
      return;
    }
    //部屋に接続するメソッド（joinRoom）
    const room = peer.joinRoom(roomId.value, {
      mode: getRoomModeByHash(),
      stream: localStream,
    });
    //部屋に接続できた時（open）に一度だけdiv(messages)に=== You joined ===を表示
    room.once('open', () => {
      messages.textContent += '=== You joined ===\n';
    });
    //部屋に誰かが接続してきた時（peerJoin）、div(messages)に下記のテキストを表示
    room.on('peerJoin', peerId => {
      messages.textContent += `=== ${peerId} joined ===\n`;
    });

    //重要：streamの内容に変更があった時（stream）videoタグを作って流す
    room.on('stream', async stream => {
      const newVideo = document.createElement('video');
      const newCanvas = document.createElement('canvas');
      newCanvas.height = 289.2;
      newCanvas.width = 385.6;
      newCanvas.setAttribute("id", "overlay");
      newCanvas.setAttribute("class", "overlay");
      newVideo.srcObject = stream;
      newVideo.playsInline = true;
      // 誰かが退出した時どの人が退出したかわかるように、data-peer-idを付与
      newVideo.setAttribute('data-peer-id', stream.peerId);
      newCanvas.setAttribute('id', stream.peerId + 'canvas');
      remoteVideos.append(newVideo);
      remoteVideos.append(newCanvas);
      await newVideo.play(console.log("新しくvideoを追加")).catch(console.error);
    });


    // 誰かが退出した場合、div（remoteVideos）内にある、任意のdata-peer-idがついたvideoタグの内容を空にして削除する
    room.on('peerLeave', peerId => {
      const remoteVideo = remoteVideos.querySelector(
        `[data-peer-id="${peerId}"]`
      );
      //videoストリームを止める上では定番の書き方らしい。https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack/stop
      remoteVideo.srcObject.getTracks().forEach(track => track.stop());
      remoteVideo.srcObject = null;
      remoteVideo.remove();

      messages.textContent += `=== ${peerId} left ===\n`;
    });

    // 自分が退出した場合の処理
    room.once('close', () => {
      //メッセージ送信ボタンを押せなくする
      sendTrigger.removeEventListener('click', onClickSend);
      //messagesに== You left ===\nを表示
      messages.textContent += '== You left ===\n';
      //remoteVideos以下の全てのvideoタグのストリームを停めてから削除
      Array.from(remoteVideos.children).forEach(remoteVideo => {
        remoteVideo.srcObject.getTracks().forEach(track => track.stop());
        remoteVideo.srcObject = null;
        remoteVideo.remove();
      });
    });
    //重要：誰かがテキストメッセージを送った時、messagesを更新
    room.on('data', ({ data }) => {
      if (data.type == 0) {
        maindata.push(data);
        if(data.status == 2) offresult--;
        else if(data.status == 3) offresult++;
      }
      else if (data.type == 1) {
        messages.textContent += data.name + ":" + data.text + `\n`;
        message_object.push(data);
        console.log(data);
        console.log(message_object);
      }
      else if (data.type == 2) {
        const board = document.querySelector("#" + data.id);
        const ctx = board.getContext("2d");
        const chara = new Image();
        chara.src = "/img/checknow.png";
        chara.onload = () => {
          ctx.drawImage(chara, 0, 0);  // ★ここを変更★
        };
      }
    });




    // ボタン（sendTrigger）を押すとonClickSendを発動
    sendTrigger.addEventListener('click', onClickSend);
    // ボタン（leaveTrigger）を押すとroom.close()を発動
    leaveTrigger.addEventListener('click', () => room.close(), { once: true });
    micTrigger.addEventListener('click', muted);
    videoTrigger.addEventListener('click', videoff);
    checktrigger.addEventListener('click', checkS);
    button1.addEventListener('click', button1_clicked);

    //テキストメッセージを送る処理
    function onClickSend() {
      const date1 = new Date();
      var new_data = { type: 1, date: date1.toLocaleString(), name: localName.value, text: localText.value };
      //room.send("["+date1.toLocaleString()+"] "+localName.value+" : "+localText.value);//送る内容
      room.send(new_data);//送る内容
      message_object.push(new_data);
      console.log(message_object);
      messages.textContent += `${localName.value} : ${localText.value}\n`;//自分側の表示用の内容
      localText.value = '';
    }
    // 音声のみミュート
    function muted() {
      if (mic) {
        localStream.getAudioTracks().forEach((track) => (track.enabled = true));
        document.getElementById("js-mic-trigger").innerHTML = '<img src="img/micon.png">';
        mic = false;
      }
      else {
        localStream.getAudioTracks().forEach((track) => (track.enabled = false));
        document.getElementById("js-mic-trigger").innerHTML = '<img src="img/micoff.png">';
        mic = true;
      }
    }
    //ビデオのみミュート
    function videoff() {
      if (video) {
        localStream.getVideoTracks().forEach((video) => (video.enabled = true));
        document.getElementById("js-video-trigger").innerHTML = '<img src="img/videon.png">';
        video = false;
      }
      //カメラオン
      else {
        localStream.getVideoTracks().forEach((video) => (video.enabled = false));
        document.getElementById("js-video-trigger").innerHTML = '<img src="img/videoff.png">';
        video = true;
      }
    }

    // var context = canvas.getContext('2d');
    canvas.width = localVideo.width;
    canvas.height = localVideo.height;

    pModel.shapeModel.nonRegularizedVectors.push(9);
    pModel.shapeModel.nonRegularizedVectors.push(11);

    delete emotionModel['angry'];
    delete emotionModel['disgusted'];
    delete emotionModel['fear'];
    delete emotionModel['sad'];


    faceOFF.parentNode.style.width = faceparaOFF + 'px';
    faceON.parentNode.style.width = faceparaON + 'px';

    startTracking();
    setInterval(counterchange, 1000);

    function startTracking() {
      // トラッキング開始
      ctracker.start(localVideo);
      drawLoop();
      isTracking = true;
    }
    function drawLoop() {
      //顔のあるなしをチェック一定回数でリセット
      countface++;//一定回数でリセット際読み込み
      if (ctracker.getCurrentPosition()) {
        // 顔のパーツの現在位置が存在
        faceparaON = 350;
        faceparaOFF = 0;
        continue_on++;
        continue_off = 0;
        determineEmotion();// 顔の判別
      } else {
        faceparaON = 0;
        faceparaOFF = 350;
        continue_off++
        continue_on = 0;
        initDisplayEmotion();
        console.log("NNN");
      }
      myfaceOFF.parentNode.style.width = faceparaOFF + 'px';
      myfaceON.parentNode.style.width = faceparaON + 'px';
      faceOFF.parentNode.style.width = '100%';
      faceON.parentNode.style.width = '100%';
      CheckCount();
      //500回でdrawroopとctrackerをリセットそれ以外は続行
      if (countface == 500) {
        console.log("reset");
        ctracker.stop();
        ctracker.reset();
        startTracking();
        countface = 0;
      } else {
        requestAnimationFrame(drawLoop);
      }
    }
    function determineEmotion() {
      // 顔の顔のパーツのパラメータ
      var currentParam = ctracker.getCurrentParameters();
      var emotionResult = EClassifier.meanPredict(currentParam);
      if (emotionResult) {
        //ここ以降行けない paramが入ってない
        for (var param in emotionResult) {
          var emotion = emotionResult[param].emotion;
          var value = emotionResult[param].value;
          if (value) {
            score = value.toFixed(1) * 100;
            switch (emotion) {
              case 'surprised':
                surprisedText.innerText = score;
                surprisedText.parentNode.style.width = 100 + score * 2.5 + 'px';
                if (20 < score) {
                  // console.log("surprised");
                  isSad = true;
                  continue_s++;
                } else {
                  isSad = false;
                  continue_s = 0;
                }
                break;
              case 'happy':
                happyText.innerText = score;
                happyText.parentNode.style.width = 100 + score * 2.5 + 'px';
                if (20 < score) {
                  // console.log("happy")
                  isHappy = true;
                  continue_h++;
                } else {
                  isHappy = false;
                  continue_h = 0;
                }
                break;
            }
          } else {
            initDisplayEmotion();
          }

        }
      } else {
        initDisplayEmotion();
      }
    }
    function initDisplayEmotion() {
      surprisedText.innerText = 0;
      surprisedText.parentNode.style.width = 100 + 'px';
      happyText.innerText = 0;
      happyText.parentNode.style.width = 100 + 'px';
    }
    //顔情報が規定の回数続いたらカウントする関数を呼び出す
    function CheckCount() {
      if (continue_h == 10) {
        pushdata(0);
        continue_h = 0;
      }
      if (continue_s == 5) {
        scount++;
        pushdata(1);
        continue_s = 0;
      }
      else if (continue_on == 300) {
        // if(flag_onoff==1){
        //   flag_onoff=0;
        // }
        pushdata(2);
        // pushdata(2);
        continue_on = 0;
      }
      else if (continue_off == 1000) {
        // if(flag_onoff==0){
        //   flag_onoff=1;
        // }
        pushdata(3);
        continue_off = 0;
      }
    }
    //表情解析結果をカウントする関数
    function pushdata(status1) {
      const date1 = new Date();
      var cdata = { type: 0, date: date1.time, name: localName.value, status: status1 }
      //concatは使えない
      maindata.push(cdata);
      room.send(cdata);
    }
    function checkS() {
      var cdata = { type: 2, id: peer.id + 'canvas' }
      console.log(cdata.id);
      console.log(peer.id);
      room.send(cdata);
      const board = document.querySelector("#overlay");
      const ctx = board.getContext("2d");
      const chara = new Image();
      chara.src = "/img/checknow.png";
      chara.onload = () => {
        ctx.drawImage(chara, 0, 0,289,216);  // ★ここを変更★
      };
    }
    function counterchange() {
      console.log(maindata);
      happycount.innerText = maindata.filter(function (x) { return x.status === 0 }).length - hcount;
      surprisedcount.innerText = maindata.filter(function (x) { return x.status === 1 }).length - scount;
      faceON.innerText = maindata.filter(function (x) { return x.status === 2 }).length;
      faceOFF.innerText =maindata.filter(function (x) { return x.status === 3 }).length;
      hcount = maindata.filter(function (x) { return x.status === 0 }).length;
      scount = maindata.filter(function (x) { return x.status === 1 }).length
    }
  })
  peer.on('error', console.error);
})();






