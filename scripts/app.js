const app = {
    data: [], 
    quizQueue: [], // Hàng đợi câu hỏi cho trắc nghiệm
    currentTopic: '',
    currentIndex: 0,
    score: 0,
    learned: JSON.parse(localStorage.getItem('vocab_learned')) || [],
    difficult: JSON.parse(localStorage.getItem('vocab_difficult')) || [],

    init: function() {
        // Tải danh sách chủ đề ngầm
        this.loadTopics();
        this.updateReviewStats();
        // Mặc định hiện trang Landing Page
        this.showSection('landing-page');
    },

    // --- NAVIGATION ---
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

    // --- DATA LOADING ---
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
            console.error(error);
            container.innerHTML = '<p style="color:red; text-align:center">Lỗi tải dữ liệu. Hãy kiểm tra file data/topics.json</p>';
        }
    },

    generateAutoExample: function(word) {
        const templates = [
            `I am trying to remember the word "<strong>${word}</strong>".`,
            `The teacher explained the meaning of "<strong>${word}</strong>" in class.`,
            `It is important to understand what "<strong>${word}</strong>" means.`,
            `Today's keyword is "<strong>${word}</strong>".`
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
                let meaning = row[1] || 'Đang cập nhật nghĩa...';
                let example = row[2];
                // Nếu không có ví dụ thì tự tạo
                if (!example || example.trim() === "") example = this.generateAutoExample(word);
                return { word, meaning, example };
            }).filter(item => item !== null);

            if (this.data.length === 0) {
                alert("File này rỗng!");
                return;
            }

            this.currentTopic = filename;
            this.currentIndex = 0;
            this.showSection('learning-dashboard');
            document.getElementById('current-topic-name').innerText = filename.replace('.xlsx', '').replace(/_/g, ' ');
            this.loadCard();
        } catch (error) {
            console.error(error);
            alert('Lỗi đọc file! Kiểm tra lại định dạng Excel.');
        }
    },

    // --- FLASHCARD LOGIC ---
    loadCard: function() {
        if (this.data.length === 0) return;
        const item = this.data[this.currentIndex];
        
        const card = document.querySelector('.flashcard');
        card.classList.remove('flipped');
        
        // Reset animation
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
            if(confirm("Bạn đã học hết từ vựng! Chuyển sang chơi game ôn tập?")) {
                this.playGameMode();
            }
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
            alert(`Đã thêm "${item.word}" vào danh sách từ khó!`);
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
        if(confirm("Xóa toàn bộ tiến độ học tập?")) {
            localStorage.clear();
            location.reload();
        }
    },

    // --- GAME AREA LOGIC ---
    playGameMode: function() {
        this.score = 0;
        this.showSection('games-section');
        document.getElementById('game-menu').classList.remove('hidden');
        document.getElementById('game-menu').style.display = 'flex';
        document.getElementById('game-area').classList.add('hidden');
        document.getElementById('game-area').innerHTML = '';
    },

    // 1. GAME TRẮC NGHIỆM (Có điểm kết thúc)
    startQuiz: function() {
        document.getElementById('game-menu').style.display = 'none';
        const area = document.getElementById('game-area');
        area.classList.remove('hidden');
        
        if(this.data.length < 4) {
            area.innerHTML = "<p>Cần ít nhất 4 từ để chơi.</p>";
            return;
        }
        
        // Tạo hàng đợi câu hỏi (xáo trộn toàn bộ từ vựng hiện có)
        this.quizQueue = [...this.data].sort(() => Math.random() - 0.5);
        this.score = 0;
        this.renderQuizQuestion();
    },

    renderQuizQuestion: function() {
        const area = document.getElementById('game-area');
        area.innerHTML = ''; 

        // Kiểm tra nếu hết câu hỏi -> KẾT THÚC
        if (this.quizQueue.length === 0) {
            area.innerHTML = `
                <div class="question-box">
                    <h2 style="color:var(--success)">Hoàn thành xuất sắc! 🎉</h2>
                    <p>Bạn đã trả lời hết các từ vựng trong chủ đề này.</p>
                    <h3>Điểm số: ${this.score}</h3>
                    <div class="action-buttons">
                        <button class="btn-prev" onclick="app.showSection('learning-dashboard')">Về bài học</button>
                        <button class="btn-game-mode" onclick="app.playGameMode()">Chọn game khác</button>
                    </div>
                </div>
            `;
            return;
        }

        // Lấy câu hỏi từ hàng đợi
        const target = this.quizQueue.pop(); 
        
        // Tạo 3 đáp án nhiễu
        let options = [target];
        while (options.length < 4) {
            let rand = this.data[Math.floor(Math.random() * this.data.length)];
            if (!options.includes(rand)) options.push(rand);
        }
        options.sort(() => Math.random() - 0.5);

        // UI
        const scoreBoard = document.createElement('div');
        scoreBoard.className = 'score-board';
        scoreBoard.innerHTML = `Điểm: ${this.score} | Còn lại: ${this.quizQueue.length + 1}`;
        area.appendChild(scoreBoard);

        const questionBox = document.createElement('div');
        questionBox.className = 'question-box';
        questionBox.innerHTML = `<h3>Chọn nghĩa của từ:</h3><h1 id="target-word" class="target-word">${target.word}</h1>`;
        
        // Phát âm tự động
        const utterance = new SpeechSynthesisUtterance(target.word);
        utterance.lang = 'en-US';
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
                    btn.classList.add('correct');
                    this.score += 10;
                    setTimeout(() => this.renderQuizQuestion(), 1000);
                } else {
                    btn.classList.add('wrong');
                    // Hiện đáp án đúng
                    allBtns.forEach(b => {
                        if (b.innerText === target.meaning) b.classList.add('correct');
                    });
                    setTimeout(() => this.renderQuizQuestion(), 2000);
                }
            };
            grid.appendChild(btn);
        });
        area.appendChild(grid);
    },

    // 2. GAME ĐIỀN TỪ (Có giải thích lỗi sai)
    startFillBlank: function() {
        document.getElementById('game-menu').style.display = 'none';
        const area = document.getElementById('game-area');
        area.classList.remove('hidden');
        area.innerHTML = '';

        // Lọc những từ có ví dụ "thật" (không phải ví dụ tự tạo bởi code)
        const validItems = this.data.filter(item => 
            item.example && 
            !item.example.includes("I am trying to remember") && 
            item.example.toLowerCase().includes(item.word.toLowerCase())
        );

        if(validItems.length < 4) {
            area.innerHTML = "<p style='text-align:center'>Cần ít nhất 4 từ có câu ví dụ đầy đủ để chơi game này.</p>";
            return;
        }

        // Chọn câu hỏi ngẫu nhiên
        const target = validItems[Math.floor(Math.random() * validItems.length)];
        
        // Thay thế từ bằng dấu ______
        const regex = new RegExp(target.word, 'gi');
        const blankSentence = target.example.replace(regex, "_______");

        // Tạo đáp án
        let options = [target];
        while (options.length < 4) {
            let rand = this.data[Math.floor(Math.random() * this.data.length)];
            if (!options.includes(rand)) options.push(rand);
        }
        options.sort(() => Math.random() - 0.5);

        // UI
        const questionBox = document.createElement('div');
        questionBox.className = 'question-box';
        questionBox.innerHTML = `
            <h3>Điền từ vào chỗ trống:</h3>
            <p style="font-size:1.3rem; font-style:italic; color:#555">"${blankSentence}"</p>
        `;
        area.appendChild(questionBox);

        const grid = document.createElement('div');
        grid.className = 'options-grid';

        // Hộp Feedback (ẩn mặc định)
        const feedbackBox = document.createElement('div');
        feedbackBox.className = 'feedback-box hidden';
        area.appendChild(feedbackBox);

        options.forEach(opt => {
            const btn = document.createElement('button');
            btn.className = 'game-btn';
            btn.innerText = opt.word; // Hiển thị từ tiếng Anh
            
            btn.onclick = () => {
                const allBtns = grid.querySelectorAll('button');
                allBtns.forEach(b => b.disabled = true);

                if (opt.word === target.word) {
                    // ĐÚNG
                    btn.classList.add('correct');
                    feedbackBox.innerHTML = `<h4 style="color:var(--success)">Chính xác! 🎉</h4><p>${target.example}</p>`;
                    feedbackBox.style.borderLeftColor = 'var(--success)';
                    feedbackBox.style.background = '#e6fffa';
                    feedbackBox.classList.remove('hidden');
                    setTimeout(() => app.startFillBlank(), 2000);
                } else {
                    // SAI - Hiện giải thích chi tiết
                    btn.classList.add('wrong');
                    feedbackBox.innerHTML = `
                        <h4>Sai rồi! 😢</h4>
                        <p><strong>Bạn chọn:</strong> "<b>${opt.word}</b>" (Nghĩa: ${opt.meaning})</p>
                        <p><strong>Nhưng câu này cần:</strong> "<b>${target.word}</b>" (Nghĩa: ${target.meaning})</p>
                        <hr style="margin:10px 0; border:0; border-top:1px solid #ddd">
                        <p><strong>Câu đúng:</strong> ${target.example}</p>
                    `;
                    feedbackBox.classList.remove('hidden');
                    
                    // Nút chơi tiếp
                    const nextBtn = document.createElement('button');
                    nextBtn.className = 'btn-next';
                    nextBtn.style.marginTop = '15px';
                    nextBtn.innerText = 'Câu tiếp theo ➡';
                    nextBtn.onclick = () => app.startFillBlank();
                    feedbackBox.appendChild(nextBtn);
                }
            };
            grid.appendChild(btn);
        });

        // Chèn grid vào trước feedback
        area.insertBefore(grid, feedbackBox);
    },

    // 3. GAME NỐI TỪ
    startMatching: function() {
        document.getElementById('game-menu').style.display = 'none';
        const area = document.getElementById('game-area');
        area.classList.remove('hidden');
        area.innerHTML = '';

        if(this.data.length < 4) {
            area.innerHTML = "<p>Cần ít nhất 4 từ để chơi.</p>";
            return;
        }

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
        
        let firstCard = null;
        let lockBoard = false;

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
                        u.lang = 'en-US';
                        window.speechSynthesis.speak(u);
                    }
                } else {
                    let secondCard = this;
                    lockBoard = true;

                    if (firstCard.dataset.id === secondCard.dataset.id) {
                        firstCard.classList.add('matched');
                        secondCard.classList.add('matched');
                        resetBoard();
                        pairsCount--;
                        document.getElementById('pairs-left').innerText = pairsCount;
                        
                        if(pairsCount === 0) {
                            setTimeout(() => alert("Chiến thắng! 🎉"), 500);
                            setTimeout(() => app.playGameMode(), 1500);
                        }
                    } else {
                        secondCard.classList.add('wrong');
                        firstCard.classList.add('wrong');
                        setTimeout(() => {
                            firstCard.classList.remove('selected', 'wrong');
                            secondCard.classList.remove('selected', 'wrong');
                            resetBoard();
                        }, 1000);
                    }
                }
            };
            grid.appendChild(card);
        });
        area.appendChild(grid);

        function resetBoard() {
            firstCard = null;
            lockBoard = false;
        }
    }
};

// Khởi chạy ứng dụng
window.onload = () => app.init();