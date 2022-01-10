var video = document.getElementById('video');
var canvas = document.getElementById('overlay');
var context = canvas.getContext('2d');
var button = document.getElementById('button');
var gallary = document.getElementById('gallary');
var sadText = document.getElementById('sadText');
var happyText = document.getElementById('happyText');
var surpriseText = document.getElementById('surprisedText');
var angryText = document.getElementById('angryText');
var disgustedText = document.getElementById('disgustedText');
var isTracking = false;
var isHappy = false;
var isSad = false;
var isSurprise = false;
var isAngry = false;
var isDisgusted = false;
var isPortrait = true;
var happyLevel;
var suplevel
var imageData;
var mosaicSize;

var happycount = 0;
var surprisedcount = 0;
var disgustedcount = 0;
var normalcount = 0;

var constraints = {
  audio: false,
  video: {
    // スマホのバックカメラを使用
    facingMode: 'environment'
  }
};
var track = new clm.tracker({
  useWebGL: true
});
var emotionClassifier = new emotionClassifier();


function successFunc(stream) {
  
  if ('srcObject' in video) {
    video.srcObject = stream;
  } else {
    window.URL = window.URL || window.webkitURL;
    video.src = (window.URL && window.URL.createObjectURL(stream));
  }
  // 動画のメタ情報のロードが完了したら実行
  video.onloadedmetadata = function () {
    adjustProportions();//ビデオサイズ調整
    startTracking();
  };
  //ビデオサイズ調整を継続
  video.onresize = function () {
    adjustProportions();
    if (isTracking) {
      track.stop();
      track.reset();
      startTracking();
    }
  };
};

function startTracking() {
  // トラッキング開始
  track.start(video);
  drawLoop();//ここで！！
  isTracking = true;
}
//ビデオのサイズ調整
function adjustProportions() {
  var ratio = video.videoWidth / video.videoHeight;
  if (ratio < 1) {
    // 画面縦長フラグ
    isPortrait = false;
  }
  video.width = Math.round(video.height * ratio);//四捨五入です
  canvas.width = video.width;
  canvas.height = video.height;
}

//カウントダウン系ボタン処理
var countdown = 40;
var countflag = false;
var button = document.getElementById("button");
button.addEventListener('click', () => {
  countdown = 0;
  countflag = true;
  console.log("initial");
  document.getElementById("button").value="Check now..";
  document.getElementById("answer").innerText="Check Now...";
});


//canvasにvideoをトレースし続ける
//ここで顔認証を呼び出している
function drawLoop() {
  console.log(track.getCurrentPosition());
  // 描画をクリア
  context.clearRect(0, 0, canvas.width, canvas.height);
  // videoをcanvasにトレース
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  // canvasの情報を取得
  imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  console.log(track.getCurrentPosition());
  if (track.getCurrentPosition()) {
    // 顔のパーツの現在位置が存在
    if (countdown < 40) {
      determineEmotion();//顔認証はこれ！！これだよ！！！
      countdown++;
      console.log("start_count");
    } else {
      if (countflag) {
        console.log("stop_count");
        document.getElementById("button").value="Check start!!";
        var max = Math.max(happycount, surprisedcount, disgustedcount);
        if (max == 0) {
          console.log("You are noreaction!!");
          document.getElementById("answer").innerHTML="<h1>You are 😶</h1>";
        }
        else if (max == happycount) {
          console.log("You are Happy!!");
          document.getElementById("answer").innerHTML="<h1>You are 😄</h1>";
        }
        else if (max == surprisedcount) {
          console.log("You are Surprised!!");
          document.getElementById("answer").innerHTML="<h1>You are 😲</h1>";
        }
        else if (max == disgustedcount) {
          console.log("You are Disgusted!!");
          document.getElementById("answer").innerHTML="<h1>You are 😡</h1>";
        }
        console.log(max);
        console.log(happycount);
        console.log(surprisedcount);
        console.log(disgustedcount);
        console.log(normalcount);

        disgustedcount = 0;
        happycount = 0;
        surprisedcount = 0;
        normalcount = 0;
        countflag = false;
      }
    }
    if (countflag) {
      if (isAngry) {
        console.log("😡");
        disgustedcount++;
      }
      if (isDisgusted) {
        console.log("😤");
        disgustedcount++;
      }
      if (isHappy) {
        console.log("☺️");
        happycount++
      }
      if (isSurprise) {
        console.log("😲");
        surprisedcount++
      } else {
        initDisplayEmotion();
        normalcount++;
      }
    }
  }
  //アニメーションの更新をブラウザの邪魔をしないタイミングで行う
  //ここでdrawloopを再起呼び出ししてるよ！！！
  requestAnimationFrame(drawLoop);
  //drawloopへ
}

//drawloopで呼び出される顔認証
//めちゃくちゃ大事！！！！！
function determineEmotion() {
  // 顔の顔のパーツのパラメータ
  var currentParam = track.getCurrentParameters();
  var emotionResult = emotionClassifier.meanPredict(currentParam);
  var countdown = true;

  if (emotionResult) {
    for (var param in emotionResult) {
      var emotion = emotionResult[param].emotion;
      var value = emotionResult[param].value;

      if (value) {
        score = value.toFixed(1) * 100;
        switch (emotion) {
          case 'happy':
            happyText.innerText = score;
            happyText.parentNode.style.width = 100 + score + 'px';
            if (60 < score) {
              isHappy = true;
            } else {
              isHappy = false;
            }
            break;
          case 'surprised':
            surpriseText.innerText = score;
            surpriseText.parentNode.style.width = 100 + score + 'px';
            if (60 < score) {
              isSurprise = true;
              countdown = false;
            } else {
              isSurprise = false;
            }
            break;
          case 'angry':
            angryText.innerText = score;
            angryText.parentNode.style.width = 100 + score + 'px';
            if (60 < score) {
              isAngry = true;
            } else {
              isAngry = false;
            }
            break;
          case 'disgusted':
            disgustedText.innerText = score;
            disgustedText.parentNode.style.width = 100 + score + 'px';
            if (60 < score) {
              isDisgusted = true;
            } else {
              isDisgusted = false;
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

//無感情の時の感情係数の初期化
function initDisplayEmotion() {
  happyText.innerText = 0;
  happyText.parentNode.style.width = 100 + 'px';
  surpriseText.innerText = 0;
  surpriseText.parentNode.style.width = 100 + 'px';
  angryText.innerText = 0;
  angryText.parentNode.style.width = 100 + 'px';
  disgustedText.innerText = 0;
  disgustedText.parentNode.style.width = 100 + 'px';
}

//眉の動きをよりよく検出するため固有ベクトル9と11を正則化しないように設定
pModel.shapeModel.nonRegularizedVectors.push(9);
pModel.shapeModel.nonRegularizedVectors.push(11);

//delete emotionModel['angry'];
//delete emotionModel['disgusted'];
delete emotionModel['fear'];
delete emotionModel['sad'];

track.init(pModel);
emotionClassifier.init(emotionModel);

// カメラから映像を取得
if (navigator.mediaDevices) {
  navigator.mediaDevices.getUserMedia(constraints)
    .then(successFunc)
    .catch((err) => {
      window.alert(err.name + ': ' + err.message);
    });
} else {
  window.alert('非対応ブラウザです');
}


