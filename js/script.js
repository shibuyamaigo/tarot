document.addEventListener('DOMContentLoaded', () => {
    // --- Elements ---
    const titleScreen = document.getElementById('title-screen');
    const startBtn = document.getElementById('start-btn');
    const inputScreen = document.getElementById('input-screen');
    const resultScreen = document.getElementById('result-screen');
    const calcBtn = document.getElementById('calc-btn');
    const appBg = document.getElementById('app-background');

    // Inputs
    const yearSelect = document.getElementById('year');
    const monthSelect = document.getElementById('month');
    const daySelect = document.getElementById('day');
    const ageSelect = document.getElementById('age');

    // BY View
    const bySection = document.getElementById('by-section');
    const byImage = document.getElementById('by-image');
    const byName = document.getElementById('by-name');
    const byTheme = document.getElementById('by-theme');

    // TY View
    const tySection = document.getElementById('ty-section');
    
    // New thumbnail elements
    const thumbMinus2 = document.getElementById('thumb-minus2');
    const thumbMinus1 = document.getElementById('thumb-minus1');
    const thumbCurrent = document.getElementById('thumb-current');
    const thumbPlus1 = document.getElementById('thumb-plus1');
    const thumbPlus2 = document.getElementById('thumb-plus2');
    
    // Main card elements
    const mainTyImage = document.getElementById('main-ty-image');
    const mainTyLabel = document.getElementById('main-ty-label');
    const mainTyName = document.getElementById('main-ty-name');
    const mainTyTheme = document.getElementById('main-ty-theme');
    
    // Navigation buttons
    const toTyBtn = document.getElementById('to-ty-btn');
    const toByBtn = document.getElementById('to-by-btn');
    const homeBtn = document.getElementById('home-btn');
    const homeBtnTy = document.getElementById('home-btn-ty');
    const prevYearBtn = document.getElementById('prev-year-btn');
    const nextYearBtn = document.getElementById('next-year-btn');
    
    // Global variables for extended year navigation
    let currentAge = 30;
    let birthYearNum = 0;
    let yearOffset = 0; // 現在年からの相対オフセット
    let displayMode = 'calculated'; // 'calculated' or 'sequential'
    let currentCardIndex = 0; // For sequential mode
    
    // Modal elements
    const cardModal = document.getElementById('card-modal');
    const closeModal = document.getElementById('close-modal');
    const modalCardImage = document.getElementById('modal-card-image');
    const modalCardName = document.getElementById('modal-card-name');
    const modalCardTheme = document.getElementById('modal-card-theme');
    const modalCardTraits = document.getElementById('modal-card-traits');
    const modalCardMessage = document.getElementById('modal-card-message');
    
    // QA Screen elements
    const qaScreen = document.getElementById('qa-screen');
    const calculatorBtn = document.getElementById('calculator-btn');
    const essenceBtn = document.getElementById('essence-btn');
    const levelSelector = document.getElementById('level-selector');
    const qaMain = document.getElementById('qa-main');
    const currentQuestion = document.getElementById('current-question');
    const nextQuestionBtn = document.getElementById('next-question-btn');
    const backToLevelsBtn = document.getElementById('back-to-levels-btn');
    const qaHomeBtn = document.getElementById('qa-home-btn');
    
    // QA Data
    let currentLevel = 1;
    let currentQuestionIndex = 0;
    const questions = {
        1: [
            "今日一番美味しかったものは何ですか？",
            "最近笑ったのはいつですか？",
            "好きな時間帯はいつですか？",
            "週末は何をして過ごしますか？",
            "最近気になっているニュースはありますか？"
        ],
        2: [
            "あなたにとって理想的な一日とはどのようなものですか？",
            "人生で一番大切にしていることは何ですか？",
            "10年後の自分はどうなっていると思いますか？",
            "今まで最も感動した経験を教えてください",
            "もし明日世界が変わるとしたら、何を一番大切にしますか？"
        ],
        3: [
            "あなたが人生で本当に恐れていることは何ですか？",
            "今まで誰にも話したことのない夢はありますか？",
            "あなたの人生を変えた瞬間について教えてください",
            "死ぬときに後悔したくないことは何ですか？",
            "愛とは何だと思いますか？"
        ],
        4: [
            "あなたの存在意義は何だと思いますか？",
            "魂の深いところで求めているものは何ですか？",
            "この世に生まれてきた理由は何だと思いますか？",
            "あなたが最も純粋だった瞬間を思い出してください",
            "宇宙の中でのあなたの役割は何だと思いますか？"
        ]
    };

    // --- Initialization ---

    // セレクトボックスの選択肢生成
    function initSelects() {
        const currentYear = new Date().getFullYear();
        
        // Year: 1940 ~ Current + 1
        for(let i = 1940; i <= currentYear + 1; i++) {
            const opt = document.createElement('option');
            opt.value = i;
            opt.text = i;
            if(i === 1990) opt.selected = true; // デフォルト1990年
            yearSelect.appendChild(opt);
        }

        // Month: 1 ~ 12
        for(let i = 1; i <= 12; i++) {
            const opt = document.createElement('option');
            opt.value = i;
            opt.text = i;
            monthSelect.appendChild(opt);
        }

        // Day: 1 ~ 31
        for(let i = 1; i <= 31; i++) {
            const opt = document.createElement('option');
            opt.value = i;
            opt.text = i;
            daySelect.appendChild(opt);
        }

        // Age: 0 ~ 100
        for(let i = 0; i <= 100; i++) {
            const opt = document.createElement('option');
            opt.value = i;
            opt.text = i + " 歳";
            if(i === 30) opt.selected = true; // 仮のデフォルト
            ageSelect.appendChild(opt);
        }
    }
    initSelects();

    // --- Navigation Logic ---

    // Entrance button events
    calculatorBtn.addEventListener('click', () => {
        titleScreen.style.opacity = '0';
        setTimeout(() => {
            titleScreen.classList.remove('active');
            inputScreen.classList.add('active');
            appBg.style.backgroundImage = "url('images/back.jpg')";
            appBg.style.opacity = '0.6'; // 背景を少し明るく
        }, 500);
    });
    
    essenceBtn.addEventListener('click', () => {
        titleScreen.style.opacity = '0';
        setTimeout(() => {
            titleScreen.classList.remove('active');
            qaScreen.classList.add('active');
            appBg.style.backgroundImage = "url('images/qaback1.jpg')";
            appBg.style.opacity = '0.7';
        }, 500);
    });

    // Input -> Result
    calcBtn.addEventListener('click', () => {
        const y = parseInt(yearSelect.value);
        const m = parseInt(monthSelect.value);
        const d = parseInt(daySelect.value);
        const age = parseInt(ageSelect.value);

        const byNum = calculateBY(y, m, d);
        showResult(byNum, age);
    });

    // --- Calculation Logic (変更なし) ---
    function sumDigits(num) {
        return String(num).split('').reduce((acc, curr) => acc + parseInt(curr), 0);
    }

    function calculateBY(y, m, d) {
        let sum = 0;
        const allDigits = (String(y) + String(m) + String(d)).split('');
        allDigits.forEach(n => sum += parseInt(n));

        if (sum === 22) return 0;
        if (sum >= 3 && sum <= 21) return sum;
        
        let finalSum = sumDigits(sum);
        if (finalSum === 22) return 0;
        while (finalSum > 21) {
            finalSum = sumDigits(finalSum);
        }
        return finalSum;
    }

    function calculateTY(age, byNum) {
        let subtractor = 0;
        if (age >= 88) subtractor = 88;
        else if (age >= 66) subtractor = 66;
        else if (age >= 44) subtractor = 44;
        else if (age >= 22) subtractor = 22;

        let base = age - subtractor;
        let ty = base + byNum;

        if (ty === 22) return 0;
        while (ty > 21) {
            ty = sumDigits(ty);
        }
        return ty;
    }

    // --- Display Logic ---
    function getCardData(num) {
        return tarotData.find(c => c.id === num) || tarotData[0];
    }

    function showResult(byNum, age) {
        // Store global values
        currentAge = age;
        birthYearNum = byNum;
        yearOffset = 0;
        
        // Update BY
        const byCard = getCardData(byNum);
        byImage.src = `images/${byCard.file}`;
        byName.textContent = byCard.name;
        byTheme.textContent = byCard.theme;
        
        // BYカードにクリックイベント追加
        byImage.onclick = () => showCardModal(byCard.id);

        // TYのモード初期化 - 計算されたカードから開始
        displayMode = 'calculated';
        const initialTY = calculateTY(currentAge, birthYearNum);
        currentCardIndex = initialTY;
        
        // Update TY
        updateTYDisplay();

        // Transition
        inputScreen.style.opacity = '0';
        setTimeout(() => {
            inputScreen.classList.remove('active');
            inputScreen.style.display = 'none';
            appBg.style.opacity = '1'; // 背景MAX
            resultScreen.classList.add('active');
        }, 500);
    }
    
    function updateTYDisplay() {
        if (displayMode === 'sequential') {
            updateSequentialDisplay();
        } else {
            const centerAge = currentAge + yearOffset;
            const ty_2 = calculateTY(centerAge - 2, birthYearNum);
            const ty_1 = calculateTY(centerAge - 1, birthYearNum);
            const ty0 = calculateTY(centerAge, birthYearNum);
            const ty1 = calculateTY(centerAge + 1, birthYearNum);
            const ty2 = calculateTY(centerAge + 2, birthYearNum);
            
            setupThumbnailsAndMain(ty_2, ty_1, ty0, ty1, ty2, centerAge);
        }
    }
    
    function updateSequentialDisplay() {
        const centerCard = currentCardIndex;
        const card_2 = Math.max(0, centerCard - 2);
        const card_1 = Math.max(0, centerCard - 1);
        const card0 = centerCard;
        const card1 = Math.min(21, centerCard + 1);
        const card2 = Math.min(21, centerCard + 2);
        
        setupThumbnailsSequential(card_2, card_1, card0, card1, card2);
    }
    
    function setupThumbnailsAndMain(ty_2, ty_1, ty0, ty1, ty2, baseAge) {
        // サムネイル画像と年齢を更新
        const thumbnailData = [
            { element: thumbMinus2, age: baseAge - 2, cardData: getCardData(ty_2) },
            { element: thumbMinus1, age: baseAge - 1, cardData: getCardData(ty_1) },
            { element: thumbCurrent, age: baseAge, cardData: getCardData(ty0) },
            { element: thumbPlus1, age: baseAge + 1, cardData: getCardData(ty1) },
            { element: thumbPlus2, age: baseAge + 2, cardData: getCardData(ty2) }
        ];
        
        thumbnailData.forEach((item, index) => {
            const img = item.element.querySelector('img');
            const span = item.element.querySelector('span');
            
            img.src = `images/${item.cardData.file}`;
            span.textContent = `${item.age}歳`;
            
            // アクティブ状態をリセット
            item.element.classList.remove('active');
            
            // 中央を基準にアクティブ設定  
            // yearOffset=0なら中央(index=2), yearOffset=1なら右(index=3), yearOffset=-1なら左(index=1)
            const activeIndex = 2 + yearOffset;
            if (index === activeIndex && activeIndex >= 0 && activeIndex < 5) {
                item.element.classList.add('active');
                
                // メインカードも更新
                mainTyImage.src = `images/${item.cardData.file}`;
                mainTyLabel.textContent = `${item.age}歳`;
                mainTyName.textContent = item.cardData.name;
                mainTyTheme.textContent = item.cardData.theme;
                
                // メインカードにクリックイベント
                mainTyImage.onclick = () => showCardModal(item.cardData.id);
            }
        });
    }
    
    function setupThumbnailsSequential(card_2, card_1, card0, card1, card2) {
        const thumbnailData = [
            { element: thumbMinus2, cardNum: card_2, cardData: getCardData(card_2) },
            { element: thumbMinus1, cardNum: card_1, cardData: getCardData(card_1) },
            { element: thumbCurrent, cardNum: card0, cardData: getCardData(card0) },
            { element: thumbPlus1, cardNum: card1, cardData: getCardData(card1) },
            { element: thumbPlus2, cardNum: card2, cardData: getCardData(card2) }
        ];
        
        thumbnailData.forEach((item, index) => {
            const img = item.element.querySelector('img');
            const span = item.element.querySelector('span');
            
            img.src = `images/${item.cardData.file}`;
            span.textContent = `${String(item.cardNum).padStart(2, '0')}`;
            
            // アクティブ状態をリセット
            item.element.classList.remove('active');
            
            // 中央をアクティブ設定
            if (index === 2) {
                item.element.classList.add('active');
                
                // メインカードも更新
                mainTyImage.src = `images/${item.cardData.file}`;
                mainTyLabel.textContent = `${String(item.cardNum).padStart(2, '0')}`;
                mainTyName.textContent = item.cardData.name;
                mainTyTheme.textContent = item.cardData.theme;
                
                // メインカードにクリックイベント
                mainTyImage.onclick = () => showCardModal(item.cardData.id);
            }
        });
    }


    // --- Universal Swipe Logic (Touch + Mouse) ---
    
    // Variables for swipe detection
    let startY = 0;
    let startX = 0;
    let isDraggingY = false;
    let isDraggingX = false;

    function handleVerticalStart(y, x) {
        startY = y;
        startX = x;
        isDraggingY = true;
        isDraggingX = true;
    }

    function handleVerticalEnd(y, x, element) {
        if(!isDraggingY && !isDraggingX) return;
        
        const diffY = startY - y;
        const diffX = startX - x;
        
        // TYページでの水平スワイプ検出（カード順移動）
        if(tySection.classList.contains('active-view') && Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
            displayMode = 'sequential';
            if (diffX > 0) { // Left swipe -> Next card
                currentCardIndex = Math.min(21, currentCardIndex + 1);
                updateTYDisplay();
            } else { // Right swipe -> Previous card
                currentCardIndex = Math.max(0, currentCardIndex - 1);
                updateTYDisplay();
            }
        }
        // 垂直スワイプ（BY <-> TY切り替え）
        else if (Math.abs(diffY) > Math.abs(diffX) && Math.abs(diffY) > 50) {
            if (diffY > 0) { // Swipe Up -> Go to TY
                if(bySection.classList.contains('active-view')) {
                    bySection.classList.remove('active-view');
                    bySection.style.display = 'none';
                    tySection.classList.add('active-view');
                    tySection.style.display = 'flex';
                }
            } else { // Swipe Down -> Go to BY
                if(tySection.classList.contains('active-view')) {
                    tySection.classList.remove('active-view');
                    tySection.style.display = 'none';
                    bySection.classList.add('active-view');
                    bySection.style.display = 'flex';
                }
            }
        }
        
        isDraggingY = false;
        isDraggingX = false;
    }

    document.addEventListener('touchstart', e => handleVerticalStart(e.touches[0].clientY, e.touches[0].clientX));
    document.addEventListener('touchend', e => handleVerticalEnd(e.changedTouches[0].clientY, e.changedTouches[0].clientX));
    
    document.addEventListener('mousedown', e => handleVerticalStart(e.clientY, e.clientX));
    document.addEventListener('mouseup', e => handleVerticalEnd(e.clientY, e.clientX));
    
    // --- Click Navigation ---
    
    // クリックでBY -> TY移動
    toTyBtn.addEventListener('click', () => {
        if(bySection.classList.contains('active-view')) {
            bySection.classList.remove('active-view');
            bySection.style.display = 'none';
            tySection.classList.add('active-view');
            tySection.style.display = 'flex'; // 明示的に表示
        }
    });
    
    // クリックでTY -> BY移動
    toByBtn.addEventListener('click', () => {
        if(tySection.classList.contains('active-view')) {
            tySection.classList.remove('active-view');
            tySection.style.display = 'none';
            bySection.classList.add('active-view');
            bySection.style.display = 'flex'; // 明示的に表示
        }
    });
    
    
    // サムネイルクリックイベント - シーケンシャルモードに切り替え
    thumbMinus2.addEventListener('click', () => { 
        displayMode = 'sequential';
        currentCardIndex = Math.max(0, currentCardIndex - 2); 
        updateTYDisplay(); 
    });
    thumbMinus1.addEventListener('click', () => { 
        displayMode = 'sequential';
        currentCardIndex = Math.max(0, currentCardIndex - 1); 
        updateTYDisplay(); 
    });
    thumbCurrent.addEventListener('click', () => { 
        // 中央は何もしない（既に表示中）
    });
    thumbPlus1.addEventListener('click', () => { 
        displayMode = 'sequential';
        currentCardIndex = Math.min(21, currentCardIndex + 1); 
        updateTYDisplay(); 
    });
    thumbPlus2.addEventListener('click', () => { 
        displayMode = 'sequential';
        currentCardIndex = Math.min(21, currentCardIndex + 2); 
        updateTYDisplay(); 
    });
    
    // 年変更ボタンのイベント（シーケンシャルモードでカード順移動）
    prevYearBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        displayMode = 'sequential';
        currentCardIndex = Math.max(0, currentCardIndex - 1);
        updateTYDisplay();
    });
    
    nextYearBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        displayMode = 'sequential';
        currentCardIndex = Math.min(21, currentCardIndex + 1);
        updateTYDisplay();
    });
    
    // ホームボタンのイベント
    function goToHome() {
        // 全ての画面を非表示にする
        resultScreen.classList.remove('active');
        inputScreen.classList.remove('active');
        qaScreen.classList.remove('active');
        titleScreen.classList.remove('active');
        
        // 明示的にdisplay: noneを設定
        inputScreen.style.display = 'none';
        resultScreen.style.display = 'none';
        qaScreen.style.display = 'none';
        
        // QAの状態もリセット
        qaMain.style.display = 'none';
        levelSelector.style.display = 'block';
        
        // 結果画面の状態もリセット
        bySection.classList.remove('active-view');
        tySection.classList.remove('active-view');
        bySection.style.display = 'none';
        tySection.style.display = 'none';
        
        // タイトル画面を完全にリセットして表示
        setTimeout(() => {
            titleScreen.classList.add('active');
            titleScreen.style.opacity = '1';
            titleScreen.style.display = 'flex';
        }, 100);
        
        // 背景をタイトル用に戻す
        appBg.style.backgroundImage = "url('images/title.jpg')";
        appBg.style.opacity = '0.3';
        
        // 変数もリセット
        yearOffset = 0;
        
        // モーダルが開いていれば閉じる
        hideCardModal();
    }
    
    homeBtn.addEventListener('click', goToHome);
    homeBtnTy.addEventListener('click', goToHome);
    qaHomeBtn.addEventListener('click', goToHome);
    
    // --- QA Functions ---
    
    function setupQALevel(level) {
        currentLevel = level;
        currentQuestionIndex = 0;
        
        // 背景画像をレベルに応じて変更
        appBg.style.backgroundImage = `url('images/qaback${level}.jpg')`;
        
        levelSelector.style.display = 'none';
        qaMain.style.display = 'block';
        
        showCurrentQuestion();
    }
    
    function showCurrentQuestion() {
        const levelQuestions = questions[currentLevel];
        if (currentQuestionIndex < levelQuestions.length) {
            currentQuestion.textContent = levelQuestions[currentQuestionIndex];
        } else {
            currentQuestion.textContent = "このレベルの質問は終了しました。別のレベルを試してみませんか？";
            nextQuestionBtn.textContent = "完了";
        }
    }
    
    function nextQuestion() {
        currentQuestionIndex++;
        showCurrentQuestion();
    }
    
    function backToLevels() {
        qaMain.style.display = 'none';
        levelSelector.style.display = 'block';
        currentQuestionIndex = 0;
        nextQuestionBtn.textContent = "次の質問";
        appBg.style.backgroundImage = "url('images/qaback1.jpg')";
    }
    
    // Level button events
    document.querySelectorAll('.level-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const level = parseInt(btn.getAttribute('data-level'));
            setupQALevel(level);
        });
    });
    
    // Reaction button events
    document.querySelectorAll('.reaction-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            // 既存の選択を解除
            document.querySelectorAll('.reaction-btn').forEach(b => b.classList.remove('selected'));
            // 現在のボタンを選択
            btn.classList.add('selected');
        });
    });
    
    nextQuestionBtn.addEventListener('click', () => {
        if (nextQuestionBtn.textContent === "完了") {
            backToLevels();
        } else {
            nextQuestion();
        }
    });
    
    backToLevelsBtn.addEventListener('click', backToLevels);


    
    // --- Modal Functions ---
    
    function showCardModal(cardId) {
        const card = getCardData(cardId);
        modalCardImage.src = `images/${card.file}`;
        modalCardName.textContent = card.name;
        modalCardTheme.textContent = card.theme;
        
        // TODO: 後でカードデータに追加する予定の詳細情報
        modalCardTraits.textContent = `${card.name}のカードは、${card.theme}を象徴しています。詳細な特性は後ほど追加されます。`;
        modalCardMessage.textContent = `このカードからのメッセージは後ほど追加されます。`;
        
        cardModal.style.display = 'block';
    }
    
    function hideCardModal() {
        cardModal.style.display = 'none';
    }
    
    // モーダルイベントリスナー
    closeModal.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        hideCardModal();
    });
    
    cardModal.addEventListener('click', (e) => {
        if (e.target === cardModal) {
            hideCardModal();
        }
    });
    
    // ESCキーでモーダルを閉じる
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && cardModal.style.display === 'block') {
            hideCardModal();
        }
    });
    
    // グローバル関数として定義（onclick属性で使用するため）
    window.showCardModal = showCardModal;
});