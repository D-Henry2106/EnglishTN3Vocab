const app = {
    data: [], 
    quizQueue: [], 
    currentTopic: '',
    currentIndex: 0,
    score: 0,
    learned: JSON.parse(localStorage.getItem('vocab_learned')) || [],
    difficult: JSON.parse(localStorage.getItem('vocab_difficult')) || [],

    init: function() {
        this.loadTopics();
        this.updateReviewStats();
        this.showSection('landing-page');
    },

    showSection: function(id) {
        document.querySelectorAll('main > section').forEach(sec => {
            sec.classList.add('hidden');
            sec.classList.remove('active-section');
        });
        const active = document.getElementById(id);
        if(active) {
            active.classList.remove('hidden');
            setTimeout(() => active.classList.add('active-section'), 10);
        }
        if(id === 'review-section') this.updateReviewStats();
    },

    loadTopics: async function() {
        const container = document.getElementById('topic-list');
        container.innerHTML = '<div class="loader">Đang tải...</div>';
        try {
            const response = await fetch('data/topics.json');
            if (!response.ok) throw new Error("Missing topics.json");
            const files = await response.json();
            container.innerHTML = '';
            files.forEach(file => {
                const name = file.replace('.xlsx', '').replace(/_/g, ' ').toUpperCase();
                const btn = document.createElement('div');
                btn.className = 'topic-card';
                btn.innerHTML = `<div class="icon">📂</div><h3>${name}</h3>`;
                btn.onclick = () => this.loadExcel(file);
                container.appendChild(btn);
            });
        } catch (error) {
            container.innerHTML = '<p style="color:red; text-align:center">Lỗi tải dữ liệu. Kiểm tra file topics.json</p>';
        }
    },

    generateAutoExample: function(word) {
        const templates = [
            `I am trying to remember the word "<strong>${word}</strong>".`,
            `The teacher explained the meaning of "<strong>${word}</strong>" in class.`,
            `It is important to understand what "<strong>${word}</strong>" means.`
        ];
        return templates[Math.floor(Math.random() * templates.length)];
    },

    loadExcel: async function(filename) {
        try {
            const response = await fetch(`data/${filename}`);
            const arrayBuffer = await response.arrayBuffer();
            const workbook = XLSX.read(arrayBuffer);
            const sheetName = workbook.SheetNames[0];
            const rawData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {header: 1});

            this.data = rawData.slice(1).map(row => {
                if (!row[0]) return null;
                let word = row[0];
                let meaning = row[1] || 'Đang cập nhật...';
                let example = row[2];
                if (!example || example.trim() === "") example = this.generateAutoExample(word);
                return { word, meaning, example };
            }).filter(item => item !== null);

            if (this.data.length === 0) { alert("File rỗng!"); return; }

            this.currentTopic = filename;
            this.currentIndex = 0;
            this.showSection('learning-dashboard');
            document.getElementById('current-topic-name').innerText = filename.replace('.xlsx', '').replace(/_/g, ' ');
            this.loadCard();
        } catch (error) {
            console.error(error);
            alert('Lỗi đọc file Excel!');
        }
    },

    loadCard: function() {
        if (this.data.length === 0) return;
        const item = this.data[this.currentIndex];
        const card = document.querySelector('.flashcard');
        card.classList.remove('flipped');
        card.style.animation = 'none';
        card.offsetHeight; 
        card.style.animation = 'fadeIn 0.5s';

        document.getElementById('card-word').innerText = item.word;
        document.getElementById('card-meaning').innerText = item.meaning;
        document.getElementById('card-example').innerHTML = item.example;
        document.getElementById('progress-text').innerText = `${this.currentIndex + 1} / ${this.data.length}`;
        const pct = ((this.currentIndex + 1) / this.data.length) * 100;
        document.getElementById('progress-fill').style.width = `${pct}%`;
    },

    nextCard: function() {
        if (this.currentIndex < this.data.length - 1) {
            this.currentIndex++;
            this.loadCard();
        } else {
            if(confirm("Đã hết từ vựng! Chơi game nhé?")) this.playGameMode();
        }
    },
    
    prevCard: function() {
        if (this.currentIndex > 0) {
            this.currentIndex--;
            this.loadCard();
        }
    },

    toggleShuffle: function() {
        this.data.sort(() => Math.random() - 0.5);
        this.currentIndex = 0;
        this.loadCard();
    },

    markAsLearned: function() {
        const word = this.data[this.currentIndex].word;
        if (!this.learned.includes(word)) {
            this.learned.push(word);
            localStorage.setItem('vocab_learned', JSON.stringify(this.learned));
            const btn = document.querySelector('.btn-mark');
            btn.innerHTML = 'Đã lưu <i class="fas fa-check"></i>';
            setTimeout(() => btn.innerHTML = 'Đã thuộc <i class="fas fa-check"></i>', 1000);
        }
        this.nextCard();
    },

    markAsDifficult: function() {
        const item = this.data[this.currentIndex];
        if (!this.difficult.some(i => i.word === item.word)) {
            this.difficult.push(item);
            localStorage.setItem('vocab_difficult', JSON.stringify(this.difficult));
            alert("Đã thêm vào danh sách từ khó!");
        }
    },

    speakWord: function() {
        const word = this.data[this.currentIndex].word;
        const utterance = new SpeechSynthesisUtterance(word);
        utterance.lang = 'en-US'; 
        window.speechSynthesis.speak(utterance);
    },

    updateReviewStats: function() {
        document.getElementById('total-learned').innerText = this.learned.length;
        document.getElementById('total-difficult').innerText = this.difficult.length;
        const list = document.getElementById('difficult-list');
        list.innerHTML = '';
        this.difficult.forEach(item => {
            const li = document.createElement('li');
            li.innerHTML = `<span>${item.word}</span> <small>${item.meaning}</small>`;
            list.appendChild(li);
        });
    },

    resetProgress: function() {
        if(confirm("Xóa toàn bộ dữ liệu?")) {
            localStorage.clear();
            location.reload();
        }
    },

    playGameMode: function() {
        this.score = 0;
        this.showSection('games-section');
        document.getElementById('game-menu').classList.remove('hidden');
        document.getElementById('game-menu').style.display = 'flex';
        document.getElementById('game-area').classList.add('hidden');
        document.getElementById('game-area').innerHTML = '';
    },

    // GAME 1: TRẮC NGHIỆM
    startQuiz: function() {
        document.getElementById('game-menu').style.display = 'none';
        const area = document.getElementById('game-area');
        area.classList.remove('hidden');
        
        if(this.data.length < 4) { area.innerHTML = "<p>Cần ít nhất 4 từ.</p>"; return; }
        
        this.quizQueue = [...this.data].sort(() => Math.random() - 0.5);
        this.score = 0;
        this.renderQuizQuestion();
    },

    renderQuizQuestion: function() {
        const area = document.getElementById('game-area');
        area.innerHTML = ''; 
        if (this.quizQueue.length === 0) {
            area.innerHTML = `<div class="question-box"><h2 style="color:var(--success)">Hoàn thành! 🎉</h2><h3>Điểm: ${this.score}</h3><button class="btn-game-mode" onclick="app.playGameMode()">Menu Game</button></div>`;
            return;
        }
        const target = this.quizQueue.pop(); 
        let options = [target];
        while (options.length < 4) {
            let rand = this.data[Math.floor(Math.random() * this.data.length)];
            if (!options.includes(rand)) options.push(rand);
        }
        options.sort(() => Math.random() - 0.5);

        const scoreBoard = document.createElement('div');
        scoreBoard.className = 'score-board';
        scoreBoard.innerHTML = `Điểm: ${this.score}`;
        area.appendChild(scoreBoard);

        const questionBox = document.createElement('div');
        questionBox.className = 'question-box';
        questionBox.innerHTML = `<h3>Chọn nghĩa của từ:</h3><h1 class="target-word">${target.word}</h1>`;
        const utterance = new SpeechSynthesisUtterance(target.word);
        window.speechSynthesis.speak(utterance);
        area.appendChild(questionBox);

        const grid = document.createElement('div');
        grid.className = 'options-grid';
        options.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = 'game-btn';
            btn.innerText = opt.meaning;
            btn.onclick = () => {
                const allBtns = grid.querySelectorAll('button');
                allBtns.forEach(b => b.disabled = true);
                if (opt.word === target.word) {
                    btn.classList.add('correct'); this.score += 10;
                    setTimeout(() => this.renderQuizQuestion(), 1000);
                } else {
                    btn.classList.add('wrong');
                    allBtns.forEach(b => { if (b.innerText === target.meaning) b.classList.add('correct'); });
                    setTimeout(() => this.renderQuizQuestion(), 2000);
                }
            };
            grid.appendChild(btn);
        });
        area.appendChild(grid);
    },

    // GAME 2: ĐIỀN TỪ (BẢN LỌC THÔNG MINH)
    startFillBlank: function() {
        document.getElementById('game-menu').style.display = 'none';
        const area = document.getElementById('game-area');
        area.classList.remove('hidden');
        area.innerHTML = '';

        const validItems = this.data.filter(item => {
            if (!item.example) return false;
            const ex = item.example.toLowerCase();
            // Lọc các câu ví dụ "tự động" để tránh lỗi đáp án
            const generic = ["trying to remember", "today's keyword", "important to understand", "explained the meaning"];
            if (generic.some(g => ex.includes(g))) return false;
            if (!ex.includes(item.word.toLowerCase())) return false;
            if (item.example.length < 15) return false;
            return true;
        });

        if(validItems.length < 4) { 
            area.innerHTML = `
                <div class="question-box">
                    <h3>⚠️ Chưa đủ dữ liệu</h3>
                    <p>Cần ít nhất 4 từ có câu ví dụ cụ thể trong file Excel.</p>
                    <button class="btn-prev" onclick='app.playGameMode()'>Quay lại</button>
                </div>`; 
            return; 
        }

        const target = validItems[Math.floor(Math.random() * validItems.length)];
        const regex = new RegExp(`\\b${target.word}\\b`, 'gi');
        const blankSentence = target.example.replace(regex, "_______");
        
        let options = [target];
        while (options.length < 4) {
            let rand = this.data[Math.floor(Math.random() * this.data.length)];
            if (rand.word !== target.word && !options.includes(rand) && !target.example.toLowerCase().includes(rand.word.toLowerCase())) {
                options.push(rand);
            }
        }
        options.sort(() => Math.random() - 0.5);

        area.innerHTML = `<div class="question-box"><h3>Điền từ vào chỗ trống:</h3><p style="font-size:1.3rem;font-style:italic">"${blankSentence}"</p></div>`;
        
        const grid = document.createElement('div');
        grid.className = 'options-grid';
        const feedbackBox = document.createElement('div');
        feedbackBox.className = 'feedback-box hidden';
        area.appendChild(grid);
        area.appendChild(feedbackBox);

        options.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = 'game-btn';
            btn.innerText = opt.word; 
            btn.onclick = () => {
                const allBtns = grid.querySelectorAll('button');
                allBtns.forEach(b => b.disabled = true);
                if (opt.word === target.word) {
                    btn.classList.add('correct');
                    feedbackBox.innerHTML = `<h4 style="color:var(--success)">Chính xác!</h4><p>${target.example}</p>`;
                    feedbackBox.style.borderLeftColor = 'var(--success)';
                    feedbackBox.style.background = '#e6fffa';
                    feedbackBox.classList.remove('hidden');
                    setTimeout(() => app.startFillBlank(), 2000);
                } else {
                    btn.classList.add('wrong');
                    allBtns.forEach(b => { if(b.innerText === target.word) b.classList.add('correct'); });
                    
                    feedbackBox.innerHTML = `<h4>Sai rồi!</h4><p>Bạn chọn: <b>${opt.word}</b></p><p>Đúng là: <b>${target.word}</b></p><hr><p>${target.example}</p><button class="btn-next" onclick="app.startFillBlank()" style="margin-top:10px">Tiếp theo</button>`;
                    feedbackBox.classList.remove('hidden');
                }
            };
            grid.appendChild(btn);
        });
    },

    // GAME 3: SẮP XẾP TỪ (MỚI)
    startScramble: function() {
        document.getElementById('game-menu').style.display = 'none';
        const area = document.getElementById('game-area');
        area.classList.remove('hidden');
        
        // Lấy 1 từ ngẫu nhiên
        const target = this.data[Math.floor(Math.random() * this.data.length)];
        const originalWord = target.word.toUpperCase().replace(/[^A-Z]/g, ''); // Chỉ lấy chữ cái
        
        // Tạo mảng ký tự và xáo trộn
        let scrambled = originalWord.split('').sort(() => 0.5 - Math.random());
        let userAnswer = [];

        // UI
        area.innerHTML = '';
        
        const questionBox = document.createElement('div');
        questionBox.className = 'question-box';
        questionBox.innerHTML = `<h3>Sắp xếp các ký tự:</h3><p class="hint-text-game">Gợi ý: ${target.meaning}</p>`;
        area.appendChild(questionBox);

        // Ô chứa đáp án
        const answerSlot = document.createElement('div');
        answerSlot.className = 'answer-slot';
        area.appendChild(answerSlot);

        // Khu vực chứa các ký tự xáo trộn
        const letterPool = document.createElement('div');
        letterPool.className = 'letter-pool';
        area.appendChild(letterPool);

        // Render các nút ký tự
        scrambled.forEach((char, index) => {
            const tile = document.createElement('div');
            tile.className = 'letter-tile';
            tile.innerText = char;
            tile.onclick = function() {
                // Di chuyển từ Pool lên Answer Slot
                this.remove();
                answerSlot.appendChild(this);
                userAnswer.push(char);
                checkWin();
                
                // Click ở trên thì trả về dưới
                this.onclick = function() {
                    this.remove();
                    letterPool.appendChild(this);
                    userAnswer.splice(userAnswer.indexOf(char), 1); // Xóa khỏi đáp án
                };
            };
            letterPool.appendChild(tile);
        });

        // Nút bỏ qua
        const skipBtn = document.createElement('button');
        skipBtn.className = 'btn-prev';
        skipBtn.style.marginTop = '20px';
        skipBtn.innerText = 'Từ khác ➡';
        skipBtn.onclick = () => app.startScramble();
        area.appendChild(skipBtn);

        function checkWin() {
            if (userAnswer.join('') === originalWord) {
                // Hiệu ứng thắng
                answerSlot.style.borderColor = 'var(--success)';
                answerSlot.style.backgroundColor = '#e6fffa';
                const utterance = new SpeechSynthesisUtterance(target.word);
                window.speechSynthesis.speak(utterance);
                setTimeout(() => alert("Chính xác! 🎉"), 100);
                setTimeout(() => app.startScramble(), 1000);
            }
        }
    },

    // GAME 4: NỐI TỪ
    startMatching: function() {
        document.getElementById('game-menu').style.display = 'none';
        const area = document.getElementById('game-area');
        area.classList.remove('hidden');
        area.innerHTML = '';

        if(this.data.length < 4) { area.innerHTML = "<p>Cần ít nhất 4 từ.</p>"; return; }

        let pairsCount = Math.min(this.data.length, 6);
        let gameData = [...this.data].sort(() => 0.5 - Math.random()).slice(0, pairsCount);
        let cards = [];
        gameData.forEach(item => {
            cards.push({ id: item.word, text: item.word, type: 'en' });
            cards.push({ id: item.word, text: item.meaning, type: 'vi' });
        });
        cards.sort(() => 0.5 - Math.random());

        const scoreBoard = document.createElement('div');
        scoreBoard.className = 'score-board';
        scoreBoard.innerHTML = `Cặp còn lại: <span id="pairs-left">${pairsCount}</span>`;
        area.appendChild(scoreBoard);

        const grid = document.createElement('div');
        grid.className = 'matching-grid';
        let firstCard = null; let lockBoard = false;

        cards.forEach(cardData => {
            const card = document.createElement('div');
            card.className = 'match-card';
            card.innerText = cardData.text;
            card.dataset.id = cardData.id;
            card.onclick = function() {
                if (lockBoard) return;
                if (this === firstCard) return;
                if (this.classList.contains('matched')) return;

                this.classList.add('selected');
                if (!firstCard) {
                    firstCard = this;
                    if(cardData.type === 'en') {
                        let u = new SpeechSynthesisUtterance(cardData.text);
                        window.speechSynthesis.speak(u);
                    }
                } else {
                    let secondCard = this;
                    lockBoard = true;
                    if (firstCard.dataset.id === secondCard.dataset.id) {
                        firstCard.classList.add('matched'); secondCard.classList.add('matched');
                        firstCard = null; lockBoard = false;
                        pairsCount--;
                        document.getElementById('pairs-left').innerText = pairsCount;
                        if(pairsCount === 0) { setTimeout(() => alert("Thắng rồi! 🎉"), 500); setTimeout(() => app.playGameMode(), 1500); }
                    } else {
                        secondCard.classList.add('wrong'); firstCard.classList.add('wrong');
                        setTimeout(() => {
                            firstCard.classList.remove('selected', 'wrong'); secondCard.classList.remove('selected', 'wrong');
                            firstCard = null; lockBoard = false;
                        }, 1000);
                    }
                }
            };
            grid.appendChild(card);
        });
        area.appendChild(grid);
    }
};

window.onload = () => app.init();