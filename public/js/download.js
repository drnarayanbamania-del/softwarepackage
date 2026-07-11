document.addEventListener('DOMContentLoaded', function() {
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }

  const fill = document.getElementById('fill');
  const statusText = document.getElementById('statusText');
  const loader = document.getElementById('loader');
  const ready = document.getElementById('ready');
  const dlBtn = document.getElementById('dlBtn');

  // Adsterra SocialBar Close
  const closeSocial = document.getElementById('closeSocial');
  const socialbar = document.getElementById('socialbar');
  if (closeSocial && socialbar) {
    closeSocial.addEventListener('click', function() {
      socialbar.style.display = 'none';
    });
  }

  // Interstitial countdown loader duration in ms
  const totalDuration = (CFG.loader || 5) * 1000;
  const startTime = Date.now();

  const statuses = [
    { threshold: 0.1, text: "Connecting to secure download server..." },
    { threshold: 0.35, text: "Verifying checksums and digital signature..." },
    { threshold: 0.65, text: "Performing cloud security virus scan..." },
    { threshold: 0.85, text: "Building download package..." },
    { threshold: 0.95, text: "Ready! Starting download..." }
  ];

  const interval = setInterval(function() {
    const elapsed = Date.now() - startTime;
    let progress = elapsed / totalDuration;

    if (progress >= 1) {
      progress = 1;
      clearInterval(interval);

      // Transition loader to ready state
      if (loader) loader.style.display = 'none';
      if (ready) ready.style.display = 'block';

      // Auto start download
      if (dlBtn) {
        window.location.href = dlBtn.href;
      }
    }

    // Update progress bar width
    if (fill) {
      fill.style.width = (progress * 100) + '%';
    }

    // Update status message text
    if (statusText) {
      const activeStatus = statuses.find(s => progress <= s.threshold);
      if (activeStatus) {
        statusText.textContent = activeStatus.text;
      }
    }
  }, 100);

  // Smartlink triggering click actions
  if (CFG.smartlink && CFG.smartlinkKey) {
    let adTriggered = false;
    document.addEventListener('click', function(e) {
      if (e.target.closest('#dlBtn') || e.target.closest('.theme-picker') || e.target.closest('.logo')) return;
      if (!adTriggered) {
        window.open('https://www.effectivecpmnetwork.com/w0wq3eigm7?key=' + CFG.smartlinkKey, '_blank');
        adTriggered = true;
      }
    });
  }
});
