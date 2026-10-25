export async function mockYouTube(page) {
  await page.addInitScript(() => {
    window.YT = {
      Player: class {
        constructor(target, config) {
          this.config = config;
          this.time = 0;
          this.playing = false;
          this.rate = 1;
          target.textContent = "YouTube API test fixture";
          this.timer = setInterval(() => {
            if (this.playing) this.time += 0.03 * this.rate;
          }, 30);
          window.testPlayer = this;
          setTimeout(() => config.events.onReady({ target: this }), 20);
        }
        getDuration() {
          return this.playing ? 60.05 : 60;
        }
        getCurrentTime() {
          return this.time;
        }
        getAvailablePlaybackRates() {
          return [0.25, 0.5, 0.75, 1];
        }
        getVideoData() {
          return { title: "A YouTube banjo tune" };
        }
        setVolume(v) {
          this.volume = v;
        }
        setPlaybackRate(v) {
          this.rate = v;
          this.config.events.onPlaybackRateChange({ data: v });
        }
        playVideo() {
          this.playing = true;
          this.config.events.onStateChange({ data: 1, target: this });
        }
        pauseVideo() {
          this.playing = false;
          this.config.events.onStateChange({ data: 2, target: this });
        }
        seekTo(v) {
          this.time = v;
        }
        destroy() {
          clearInterval(this.timer);
        }
      },
    };
  });
}
