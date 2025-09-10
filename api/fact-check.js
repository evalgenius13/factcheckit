<script>
  let isLoading = false;

  function updateCharCount() {
    const textarea = document.getElementById('claim');
    const counter = document.getElementById('charCounter');
    counter.textContent = `${textarea.value.length}/1000`;
  }

  async function factCheck() {
    const claim = document.getElementById('claim').value.trim();
    const btn = document.getElementById('factCheckBtn');
    const results = document.getElementById('results');
    if (!claim || isLoading) return;

    isLoading = true;
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner"></div> Fact-Checking...';
    results.innerHTML = '';

    try {
      const response = await fetch('/api/fact-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claim })
      });
      const data = await response.json();
      if (data.success) {
        showResults(data);
      } else {
        showError(data.error || 'Something went wrong');
      }
    } catch (err) {
      showError('Network error. Please try again.');
    } finally {
      isLoading = false;
      btn.disabled = false;
      btn.innerHTML = '⚡ Fact-Check It!';
    }
  }

  function showResults(data) {
    const results = document.getElementById('results');
    const explanation = (data.summary || '').trim();

    results.innerHTML = `
      <div class="card result">
        <p class="explanation">${explanation}</p>
        <button 
          class="btn btn-primary" 
          onclick="shareResult('${data.shortId}')">
          🔗 Share this fact-check
        </button>
      </div>
    `;
  }

  function showError(message) {
    const results = document.getElementById('results');
    results.innerHTML = `
      <div class="card result">
        <div class="error">
          <div class="error-icon">❌</div>
          <h3>Error</h3>
          <p>${message}</p>
        </div>
      </div>`;
  }

  function isMobileDevice() {
    return /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  }

  function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    requestAnimationFrame(() => { toast.style.opacity = '1'; });
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  }

  function shareResult(shortId) {
    const shareUrl = `${window.location.origin}/fact/${shortId}`;
    if (isMobileDevice() && navigator.share) {
      navigator.share({ title: 'Fact-CheckIt', url: shareUrl }).catch(err => console.log('Share cancelled', err));
    } else {
      navigator.clipboard.writeText(shareUrl)
        .then(() => showToast('✅ Link copied to clipboard!'))
        .catch(() => showToast('❌ Could not copy link.'));
    }
  }

  window.addEventListener('DOMContentLoaded', async () => {
    const pathParts = window.location.pathname.split('/');
    if (pathParts[1] === 'fact' && pathParts[2]) {
      const shortId = pathParts[2];
      try {
        const response = await fetch(`/api/fact?id=${shortId}`);
        const data = await response.json();
        if (data.success) {
          showResults({ summary: data.summary, shortId });
        } else {
          showError('Fact-check not found.');
        }
      } catch {
        showError('Error loading fact-check.');
      }
    } else {
      updateCharCount();
    }
  });
</script>
