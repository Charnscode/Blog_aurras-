   // Configuration API
    const API_URL = 'http://localhost/blog-aurras/api'; // CHANGEZ avec votre URL

    // État de l'application
    let allArticles = [];
    let currentFilter = 'all';
    let currentArticleId = null;
    let likedArticles = new Set();
    let savedArticles = new Set();
    let isFollowing = false;

    // Initialisation
    document.addEventListener('DOMContentLoaded', function() {
      loadStats();
      loadArticles();
      checkFollowStatus();
      setupScrollButton();
      setupSmoothScroll();
    });

    // Charger les statistiques
    async function loadStats() {
      try {
        const response = await fetch(`${API_URL}/stats`);
        const data = await response.json();
        
        if(data.success) {
          animateCounter('totalArticles', data.data.total_articles);
          animateCounter('totalFollowers', data.data.total_followers);
          animateCounter('totalLikes', data.data.total_likes);
          animateCounter('totalViews', data.data.total_views);
          animateCounter('totalComments', data.data.total_comments);
        }
      } catch(error) {
        console.error('Erreur stats:', error);
      }
    }

    // Animation des compteurs
    function animateCounter(elementId, target) {
      const element = document.getElementById(elementId);
      const duration = 2000;
      const start = 0;
      const increment = target / (duration / 16);
      let current = start;

      const timer = setInterval(() => {
        current += increment;
        if (current >= target) {
          element.textContent = target;
          clearInterval(timer);
        } else {
          element.textContent = Math.floor(current);
        }
      }, 16);
    }

    // Charger les articles
    async function loadArticles() {
      showLoading(true);
      try {
        const response = await fetch(`${API_URL}/articles`);
        const data = await response.json();
        
        if(data.success) {
          allArticles = data.data;
          await checkUserStatus();
          renderArticles(allArticles);
        }
      } catch(error) {
        console.error('Erreur articles:', error);
        showError('Erreur de chargement des articles');
      } finally {
        showLoading(false);
      }
    }

    // Vérifier le statut utilisateur (likes, saves)
    async function checkUserStatus() {
      for(let article of allArticles) {
        try {
          const response = await fetch(`${API_URL}/check-status/${article.id}`);
          const data = await response.json();
          
          if(data.success) {
            if(data.data.liked) likedArticles.add(article.id);
            if(data.data.saved) savedArticles.add(article.id);
            if(data.data.following) {
              isFollowing = true;
              updateFollowButton();
            }
          }
        } catch(error) {
          console.error('Erreur check status:', error);
        }
      }
    }

    // Afficher les articles
    function renderArticles(articles) {
      const container = document.getElementById('articlesGrid');
      
      if(articles.length === 0) {
        container.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">📭</div>
            <h3>Aucun article trouvé</h3>
            <p>Essayez un autre filtre ou recherche</p>
          </div>
        `;
        return;
      }

      container.innerHTML = articles.map((article, index) => {
        const isLiked = likedArticles.has(article.id);
        const isSaved = savedArticles.has(article.id);
        const isTrending = article.views > 200 || article.likes > 50;
        
        return `
          <div class="article-card">
            <div class="article-image-container">
              <img src="${article.image_url || 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=800&q=80'}" 
                   alt="${article.title}" class="article-image">
              <span class="article-category">${article.category}</span>
              ${isTrending ? '<span class="trending-badge">🔥 Tendance</span>' : ''}
            </div>
            <div class="article-content">
              <h3 class="article-title">${article.title}</h3>
              <p class="article-excerpt">${article.excerpt}</p>
              <div class="article-meta">
                <span class="meta-item">📅 ${formatDate(article.created_at)}</span>
                <span class="meta-item">⏱️ ${article.read_time || '5 min'}</span>
                <span class="meta-item">👁️ ${article.views}</span>
              </div>
              <div class="article-actions">
                <button class="action-btn ${isLiked ? 'liked' : ''}" onclick="toggleLike(${article.id})">
                  ${isLiked ? '❤️' : '🤍'} <span id="likes-${article.id}">${article.likes}</span>
                </button>
                <button class="action-btn" onclick="openArticle(${article.id})">
                  💬 ${article.comment_count || 0}
                </button>
                <button class="action-btn" onclick="shareArticle(${article.id})">
                  📤
                </button>
                <button class="action-btn ${isSaved ? 'saved' : ''}" onclick="toggleSave(${article.id})">
                  ${isSaved ? '⭐' : '☆'}
                </button>
              </div>
              <button class="read-btn" onclick="openArticle(${article.id})">Lire l'article</button>
            </div>
          </div>
        `;
      }).join('');
    }

    // Formater la date
    function formatDate(dateString) {
      const date = new Date(dateString);
      const options = { year: 'numeric', month: 'long', day: 'numeric' };
      return date.toLocaleDateString('fr-FR', options);
    }

    // Filtrer les articles
    function filterArticles(category) {
      currentFilter = category;
      
      // Update active button
      document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
      });
      event.target.classList.add('active');
      
      const filtered = category === 'all' 
        ? allArticles 
        : allArticles.filter(a => a.category === category);
      
      renderArticles(filtered);
    }

    // Rechercher des articles
    function searchArticles() {
      const query = document.getElementById('searchInput').value.toLowerCase();
      
      if(!query) {
        renderArticles(allArticles);
        return;
      }

      const filtered = allArticles.filter(article => 
        article.title.toLowerCase().includes(query) ||
        article.excerpt.toLowerCase().includes(query) ||
        article.category.toLowerCase().includes(query)
      );
      
      renderArticles(filtered);
    }

    // Enter key pour recherche
    document.getElementById('searchInput').addEventListener('keypress', function(e) {
      if(e.key === 'Enter') {
        searchArticles();
      }
    });

    // Toggle Follow
    async function toggleFollow() {
      try {
        const response = await fetch(`${API_URL}/follow`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });
        
        const data = await response.json();
        
        if(data.success) {
          isFollowing = !isFollowing;
          updateFollowButton();
          
          // Update follower count
          document.getElementById('totalFollowers').textContent = data.total || 
            (isFollowing ? parseInt(document.getElementById('totalFollowers').textContent) + 1 : 
             parseInt(document.getElementById('totalFollowers').textContent) - 1);
        }
      } catch(error) {
        console.error('Erreur follow:', error);
      }
    }

    function updateFollowButton() {
      const btn = document.getElementById('followBtn');
      if(isFollowing) {
        btn.textContent = '✓ Abonné';
        btn.classList.add('following');
      } else {
        btn.textContent = '+ Suivre';
        btn.classList.remove('following');
      }
    }

    async function checkFollowStatus() {
      try {
        const response = await fetch(`${API_URL}/check-status/1`);
        const data = await response.json();
        if(data.success && data.data.following) {
          isFollowing = true;
          updateFollowButton();
        }
      } catch(error) {
        console.error('Erreur check follow:', error);
      }
    }

    // Toggle Like
    async function toggleLike(articleId) {
      try {
        const response = await fetch(`${API_URL}/like`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ article_id: articleId })
        });
        
        const data = await response.json();
        
        if(data.success) {
          if(data.action === 'liked') {
            likedArticles.add(articleId);
          } else {
            likedArticles.delete(articleId);
          }
          
          // Update UI
          const likeElement = document.getElementById(`likes-${articleId}`);
          if(likeElement) likeElement.textContent = data.likes;
          
          // Update modal if open
          if(currentArticleId === articleId) {
            document.getElementById('modalLikes').textContent = data.likes;
            const modalBtn = document.getElementById('modalLikeBtn');
            if(data.action === 'liked') {
              modalBtn.innerHTML = `❤️ <span id="modalLikes">${data.likes}</span>`;
              modalBtn.classList.add('liked');
            } else {
              modalBtn.innerHTML = `🤍 <span id="modalLikes">${data.likes}</span>`;
              modalBtn.classList.remove('liked');
            }
          }
          
          renderArticles(currentFilter === 'all' ? allArticles : allArticles.filter(a => a.category === currentFilter));
          loadStats();
        }
      } catch(error) {
        console.error('Erreur like:', error);
      }
    }

    // Toggle Save
    async function toggleSave(articleId) {
      try {
        const response = await fetch(`${API_URL}/save`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ article_id: articleId })
        });
        
        const data = await response.json();
        
        if(data.success) {
          if(data.action === 'saved') {
            savedArticles.add(articleId);
          } else {
            savedArticles.delete(articleId);
          }
          
          renderArticles(currentFilter === 'all' ? allArticles : allArticles.filter(a => a.category === currentFilter));
        }
      } catch(error) {
        console.error('Erreur save:', error);
      }
    }

    // Share Article
    function shareArticle(articleId) {
      const article = allArticles.find(a => a.id === articleId);
      
      if (navigator.share) {
        navigator.share({
          title: article.title,
          text: article.excerpt,
          url: window.location.href
        });
      } else {
        alert('🎉 Partagez cet article sur vos réseaux sociaux !\n\n' + article.title);
      }
    }

    // Ouvrir un article
    async function openArticle(articleId) {
      currentArticleId = articleId;
      const article = allArticles.find(a => a.id === articleId);
      
      if(!article) return;

      // Remplir le modal
      document.getElementById('modalArticleImage').src = article.image_url || 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=800&q=80';
      document.getElementById('modalArticleTitle').textContent = article.title;
      document.getElementById('modalArticleMeta').innerHTML = `
        <span class="meta-item">📅 ${formatDate(article.created_at)}</span>
        <span class="meta-item">⏱️ ${article.read_time || '5 min'}</span>
        <span class="meta-item">👁️ ${article.views} vues</span>
        <span class="meta-item">📁 ${article.category}</span>
      `;
      document.getElementById('modalArticleContent').innerHTML = article.content || article.excerpt;
      
      // Update action buttons
      const isLiked = likedArticles.has(articleId);
      const isSaved = savedArticles.has(articleId);
      
      document.getElementById('modalLikeBtn').innerHTML = isLiked ? 
        `❤️ <span id="modalLikes">${article.likes}</span>` : 
        `🤍 <span id="modalLikes">${article.likes}</span>`;
      document.getElementById('modalLikeBtn').className = isLiked ? 'action-btn liked' : 'action-btn';
      
      document.getElementById('modalSaveBtn').innerHTML = isSaved ? '⭐ Sauvegardé' : '☆ Sauvegarder';
      document.getElementById('modalSaveBtn').className = isSaved ? 'action-btn saved' : 'action-btn';
      
      // Charger les commentaires
      await loadComments(articleId);
      
      // Afficher le modal
      document.getElementById('commentsModal').classList.add('active');
      document.body.style.overflow = 'hidden';
    }

    // Charger les commentaires
    async function loadComments(articleId) {
      try {
        const response = await fetch(`${API_URL}/comments/${articleId}`);
        const data = await response.json();
        
        const container = document.getElementById('commentsList');
        
        if(!data.success || data.data.length === 0) {
          container.innerHTML = '<div class="no-comments">💭 Soyez le premier à commenter !</div>';
          return;
        }

        container.innerHTML = data.data.map(comment => `
          <div class="comment-item">
            <div class="comment-header">
              <span class="comment-author">👤 ${comment.author_name}</span>
              <span class="comment-date">${formatDate(comment.created_at)}</span>
            </div>
            <p class="comment-text">${comment.comment_text}</p>
          </div>
        `).join('');
      } catch(error) {
        console.error('Erreur comments:', error);
      }
    }

    // Soumettre un commentaire
    async function submitComment() {
      const userName = document.getElementById('userName').value.trim();
      const commentText = document.getElementById('commentText').value.trim();
      
      if(!userName || !commentText) {
        alert('Veuillez remplir tous les champs !');
        return;
      }

      try {
        const response = await fetch(`${API_URL}/comments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            article_id: currentArticleId,
            author_name: userName,
            comment_text: commentText
          })
        });
        
        const data = await response.json();
        
        if(data.success) {
          document.getElementById('userName').value = '';
          document.getElementById('commentText').value = '';
          await loadComments(currentArticleId);
          await loadArticles(); // Reload pour mettre à jour le compteur
          loadStats();
        }
      } catch(error) {
        console.error('Erreur submit comment:', error);
        alert('Erreur lors de l\'envoi du commentaire');
      }
    }

    // Actions depuis le modal
    function likeFromModal() {
      toggleLike(currentArticleId);
    }

    function saveFromModal() {
      toggleSave(currentArticleId);
    }

    function shareFromModal() {
      shareArticle(currentArticleId);
    }

    // Fermer le modal
    function closeModal() {
      document.getElementById('commentsModal').classList.remove('active');
      document.body.style.overflow = 'auto';
      currentArticleId = null;
    }

    // Fermer modal en cliquant dehors
    document.getElementById('commentsModal').addEventListener('click', function(e) {
      if(e.target === this) {
        closeModal();
      }
    });

    // Newsletter
    async function subscribeNewsletter(e) {
      e.preventDefault();
      const email = e.target.querySelector('input').value;
      
      try {
        const response = await fetch(`${API_URL}/follow`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email })
        });
        
        const data = await response.json();
        
        if(data.success) {
          alert('✅ Merci de votre abonnement !');
          e.target.reset();
          isFollowing = true;
          updateFollowButton();
          loadStats();
        }
      } catch(error) {
        console.error('Erreur newsletter:', error);
        alert('❌ Erreur lors de l\'inscription');
      }
    }

    // Back to Top Button
    function setupScrollButton() {
      const backToTopBtn = document.getElementById('backToTop');
      
      window.addEventListener('scroll', () => {
        if(window.pageYOffset > 300) {
          backToTopBtn.classList.add('visible');
        } else {
          backToTopBtn.classList.remove('visible');
        }
      });
    }

    function scrollToTop() {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }

    // Smooth scroll pour les liens d'ancrage
    function setupSmoothScroll() {
      document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
          e.preventDefault();
          const target = document.querySelector(this.getAttribute('href'));
          if(target) {
            target.scrollIntoView({
              behavior: 'smooth',
              block: 'start'
            });
          }
        });
      });
    }

    // Loading
    function showLoading(show) {
      const loading = document.getElementById('loading');
      if(show) {
        loading.classList.add('active');
      } else {
        loading.classList.remove('active');
      }
    }

    // Error
    function showError(message) {
      alert(message);
    }