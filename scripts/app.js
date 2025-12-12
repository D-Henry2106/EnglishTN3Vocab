const app = {
    data: [], 
    currentTopic: '',
    currentIndex: 0,
    learned: JSON.parse(localStorage.getItem('vocab_learned')) || [],
    difficult: JSON.parse(localStorage.getItem('vocab_difficult')) || [],

    init: function() {
        this.loadTopics();
        this.updateReviewStats();
    },

    showSection: function(id) {
        document.querySelectorAll('main > section').forEach(sec => {
            sec.classList.add('hidden');
            sec.classList.remove('active-section');
        });
        const active = document.getElementById(id);
        active.classList.remove('hidden');
        setTimeout(() => active.classList.add('active-section'), 10);
        if(id === 'review-section') this.updateReviewStats();
    },

    loadTopics: async function() {
        const container = document.getElementById('topic-list');
        container.innerHTML = '<div class="loader">Loading...</div>';
        
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
            container.innerHTML = '<p style="color:red; text-align:center">Lỗi: Không tìm thấy file topics.json</p>';
        }
    },

    // --- TỰ ĐỘNG TẠO VÍ DỤ NẾU THIẾU ---
    generateAutoExample: function(word) {
        const templates = [
            `I am trying to remember the word "<strong>${word}</strong>".`,
            `The teacher explained the meaning of "<strong>${word}</strong>" in class.`,
            `Have you ever heard the word "<strong>${word}</strong>" before?`,
            `It is important to understand what "<strong>${word}</strong>" means.`,
            `We can use "<strong>${word}</strong>" in many different contexts.`,
            `Please look up "<strong>${word}</strong>" in the dictionary.`,
            `Today's keyword is "<strong>${word}</strong>".`,
            `Let's make a sentence with "<strong>${word}</strong>".`,
            `I found the word "<strong>${word}</strong>" in a book yesterday.`
        ];
        // Chọn ngẫu nhiên 1 câu
        return templates[Math.floor(Math.random() * templates.length)];
    },

    loadExcel: async function(filename) {
        try {
            const response = await fetch(`data/${filename}`);
            const arrayBuffer = await response.arrayBuffer();
            const workbook = XLSX.read(arrayBuffer);
            const sheetName = workbook.SheetNames[0];
            
            // Đọc file Excel bỏ qua tiêu đề cột
            const rawData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {header: 1});

            // Xử lý dữ liệu
            this.data = rawData.slice(1).map(row => {
                if (!row[0]) return null;
                
                let word = row[0];
                let meaning = row[1] || 'Đang cập nhật nghĩa...';
                let example = row[2]; // Lấy cột ví dụ từ Excel

                // LOGIC: Nếu cột ví dụ trống, tự động tạo câu
                if (!example || example.trim() === "") {
                    example = this.generateAutoExample(word);
                }

                return { word, meaning, example };
            }).filter(item => item !== null);

            if (this.data.length === 0) {
                alert("File này chưa có từ vựng nào!");
                return;
            }

            this.currentTopic = filename;
            this.currentIndex = 0;
            this.showSection('learning-dashboard');
            document.getElementById('current-topic-name').innerText = filename.replace('.xlsx', '').replace(/_/g, ' ');
            this.loadCard();
        } catch (error) {
            console.error(error);
            alert('Lỗi đọc file! Kiểm tra lại file Excel trong thư mục data.');
        }
    },

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
        
        // Hiển thị ví dụ (có hỗ trợ HTML để in đậm từ vựng)
        document.getElementById('card-example').innerHTML = item.example;

        // Cập nhật thanh tiến độ
        document.getElementById('progress-text').innerText = `${this.currentIndex + 1} / ${this.data.length}`;
        const pct = ((this.currentIndex + 1) / this.data.length) * 100;
        document.getElementById('progress-fill').style.width = `${pct}%`;
    },

    nextCard: function() {
        if (this.currentIndex < this.data.length - 1) {
            this.currentIndex++;
            this.loadCard();
        } else {
            if(confirm("Bạn đã học hết từ vựng chủ đề này! Chuyển sang chơi game nhé?")) {
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
            btn.innerHTML = 'Saved! <i class="fas fa-check"></i>';
            setTimeout(() => btn.innerHTML = 'Mark Learned <i class="fas fa-check"></i>', 1000);
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
        if(this.difficult.length === 0) {
            list.innerHTML = '<p style="opacity:0.6">Chưa có từ khó nào.</p>';
        }
        this.difficult.forEach(item => {
            const li = document.createElement('li');
            li.innerHTML = `<span>${item.word}</span> <small>${item.meaning}</small>`;
            list.appendChild(li);
        });
    },

    resetProgress: function() {
        if(confirm("Bạn có chắc muốn xóa toàn bộ lịch sử học?")) {
            localStorage.clear();
            location.reload();
        }
    },
    
    playGameMode: function() {
        this.showSection('games-section');
    },

    // --- GAME LOGIC ---
    startQuiz: function() {
        const area = document.getElementById('game-area');
        if(this.data.length < 4) {
            area.innerHTML = "<p>Cần ít nhất 4 từ vựng để tạo câu hỏi trắc nghiệm.</p>";
            return;
        }

        const target = this.data[Math.floor(Math.random() * this.data.length)];
        let options = [target];
        while (options.length < 4) {
            let rand = this.data[Math.floor(Math.random() * this.data.length)];
            if (!options.includes(rand)) options.push(rand);
        }
        options.sort(() => Math.random() - 0.5);

        let html = `
            <div class="quiz-container">
                <h3>Chọn nghĩa đúng của: <br><span class="highlight-word">${target.word}</span></h3>
                <div class="options-grid">
        `;
        
        options.forEach(opt => {
            html += `<button class="game-btn" onclick="app.checkAnswer(this, '${opt.word}', '${target.word}')">${opt.meaning}</button>`;
        });
        
        html += `</div></div>`;
        area.innerHTML = html;
    },

    checkAnswer: function(btn, selected, correct) {
        const allBtns = document.querySelectorAll('.game-btn');
        allBtns.forEach(b => b.disabled = true);

        if (selected === correct) {
            btn.classList.add('correct');
            setTimeout(() => this.startQuiz(), 1000);
        } else {
            btn.classList.add('wrong');
            allBtns.forEach(b => {
                if(b.innerText === this.data.find(i => i.word === correct).meaning) {
                    b.classList.add('correct');
                }
            });
            setTimeout(() => this.startQuiz(), 2000);
        }
    },

    startMatch: function() {
        document.getElementById('game-area').innerHTML = "<p style='text-align:center'>Tính năng đang phát triển...</p>";
    }
};

window.onload = () => app.init();