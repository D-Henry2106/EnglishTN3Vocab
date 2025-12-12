const app = {
    data: [], // Stores current topic vocabulary
    currentTopic: '',
    currentIndex: 0,
    learned: JSON.parse(localStorage.getItem('vocab_learned')) || [],
    difficult: JSON.parse(localStorage.getItem('vocab_difficult')) || [],

    init: function() {
        this.loadTopics();
        this.updateReviewStats();
    },

    // --- NAVIGATION ---
    showSection: function(id) {
        document.querySelectorAll('main > section').forEach(sec => sec.classList.add('hidden'));
        document.querySelectorAll('main > section').forEach(sec => sec.classList.remove('active-section'));
        document.getElementById(id).classList.remove('hidden');
        document.getElementById(id).classList.add('active-section');
        if(id === 'review-section') this.updateReviewStats();
    },

    // --- DATA LOADING ---
    loadTopics: async function() {
        const container = document.getElementById('topic-list');
        try {
            // Read topics.json to get file list
            const response = await fetch('data/topics.json');
            if (!response.ok) throw new Error("Could not load topics.json");
            
            const files = await response.json();
            container.innerHTML = '';

            files.forEach(file => {
                const name = file.replace('.xlsx', '').replace(/_/g, ' ').toUpperCase();
                const btn = document.createElement('div');
                btn.className = 'topic-card';
                btn.innerText = name;
                btn.onclick = () => this.loadExcel(file);
                container.appendChild(btn);
            });
        } catch (error) {
            container.innerHTML = '<p style="color:red">Error loading topics. Make sure data/topics.json exists.</p>';
            console.error(error);
        }
    },

    loadExcel: async function(filename) {
        try {
            const response = await fetch(`data/${filename}`);
            const arrayBuffer = await response.arrayBuffer();
            const workbook = XLSX.read(arrayBuffer);
            const sheetName = workbook.SheetNames[0];
            const jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

            // Normalization & Fallback for missing Examples
            this.data = jsonData.map(item => ({
                word: item['Vocabulary'] || item['Word'] || 'Unknown',
                meaning: item['Meaning'] || 'No definition',
                example: item['Example'] ? item['Example'] : `I am learning the word "${item['Vocabulary'] || 'this'}" today.`
            }));

            this.currentTopic = filename;
            this.currentIndex = 0;
            this.showSection('learning-dashboard');
            document.getElementById('current-topic-name').innerText = filename.replace('.xlsx', '');
            this.loadCard();
        } catch (error) {
            alert('Error reading Excel file. Ensure it is in /data folder.');
            console.error(error);
        }
    },

    // --- FLASHCARD LOGIC ---
    loadCard: function() {
        if (this.data.length === 0) return;
        const item = this.data[this.currentIndex];
        
        // Reset Flip
        document.querySelector('.flashcard').classList.remove('flipped');
        
        // Content
        document.getElementById('card-word').innerText = item.word;
        document.getElementById('card-meaning').innerText = item.meaning;
        document.getElementById('card-example').innerText = item.example;

        // Update Progress UI
        document.getElementById('progress-text').innerText = `${this.currentIndex + 1} / ${this.data.length}`;
        const pct = ((this.currentIndex + 1) / this.data.length) * 100;
        document.getElementById('progress-fill').style.width = `${pct}%`;
    },

    nextCard: function() {
        if (this.currentIndex < this.data.length - 1) {
            this.currentIndex++;
            this.loadCard();
        } else {
            alert("End of topic! Try the review games.");
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
        alert("Cards shuffled!");
    },

    // --- TRACKING ---
    markAsLearned: function() {
        const word = this.data[this.currentIndex].word;
        if (!this.learned.includes(word)) {
            this.learned.push(word);
            localStorage.setItem('vocab_learned', JSON.stringify(this.learned));
            // Visual feedback
            const btn = document.querySelector('.btn-mark');
            const originalText = btn.innerText;
            btn.innerText = "Saved!";
            setTimeout(() => btn.innerText = originalText, 1000);
        }
        this.nextCard();
    },

    markAsDifficult: function() {
        const item = this.data[this.currentIndex];
        if (!this.difficult.some(i => i.word === item.word)) {
            this.difficult.push(item); // Save whole object for review
            localStorage.setItem('vocab_difficult', JSON.stringify(this.difficult));
             alert(`MARKED "${item.word}" as difficult.`);
        }
    },

    // --- SPEECH ---
    speakWord: function() {
        const word = this.data[this.currentIndex].word;
        const utterance = new SpeechSynthesisUtterance(word);
        utterance.lang = 'en-US';
        window.speechSynthesis.speak(utterance);
    },

    // --- REVIEW SECTION ---
    updateReviewStats: function() {
        document.getElementById('total-learned').innerText = this.learned.length;
        document.getElementById('total-difficult').innerText = this.difficult.length;

        const list = document.getElementById('difficult-list');
        list.innerHTML = '';
        this.difficult.forEach(item => {
            const li = document.createElement('li');
            li.innerHTML = `<b>${item.word}</b> - ${item.meaning}`;
            list.appendChild(li);
        });
    },

    resetProgress: function() {
        if(confirm("Are you sure? This deletes all progress.")) {
            localStorage.clear();
            this.learned = [];
            this.difficult = [];
            this.updateReviewStats();
            location.reload();
        }
    },
    
    playGameMode: function() {
        this.showSection('games-section');
    }
};

const game = {
    startQuiz: function() {
        const area = document.getElementById('game-area');
        if(app.data.length < 4) {
            area.innerHTML = "<p>Not enough words to play (need at least 4).</p>";
            return;
        }

        // Pick random target
        const targetIndex = Math.floor(Math.random() * app.data.length);
        const target = app.data[targetIndex];
        
        // Pick 3 distractors
        let options = [target];
        while (options.length < 4) {
            let rand = app.data[Math.floor(Math.random() * app.data.length)];
            if (!options.includes(rand)) options.push(rand);
        }
        options.sort(() => Math.random() - 0.5);

        // Render
        let html = `<h3>What is the meaning of: <span style="color:var(--primary)">${target.word}</span>?</h3>`;
        options.forEach(opt => {
            html += `<button class="game-option" onclick="game.checkAnswer(this, '${opt.word}', '${target.word}')">${opt.meaning}</button>`;
        });
        area.innerHTML = html;
    },

    checkAnswer: function(btn, selectedWord, correctWord) {
        if (selectedWord === correctWord) {
            btn.classList.add('correct');
            setTimeout(() => this.startQuiz(), 1000); // Next question
        } else {
            btn.classList.add('wrong');
        }
    },

    startMatch: function() {
        document.getElementById('game-area').innerHTML = "<p>Matching game coming in v2! (Try Multiple Choice)</p>";
    }
};

// Initialize
window.onload = () => app.init();