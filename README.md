# StreamHub IPTV — Premium Simple Version

No admin page. No backend. No database. GitHub Pages / Vercel friendly.

## Files
- index.html — user website
- style.css — premium responsive design
- app.js — search, filters, player, theme, animations
- channels.js — add your permanent public channels

## Add a channel
Open `channels.js` and add:

{
  name: "Channel Name",
  category: "News",
  logo: "https://example.com/logo.png",
  url: "https://example.com/live/stream.m3u8",
  type: "hls"
}

Types:
- hls — .m3u8
- video — MP4/WebM/OGG/browser-supported video
- embed — YouTube/Vimeo/Dailymotion/iframe-compatible URL
- auto — automatic detection

## GitHub Pages
Upload all 4 files to a repository.
Settings → Pages → Deploy from branch → main → root.
No build command.

## Important playback limitation
The website/player cannot bypass stream authentication, CORS, geo-blocking, DRM or expired tokens. RTSP/RTMP/raw TS streams generally need a server-side gateway/transmuxer before a normal browser can play them.

## Local "Add Channel"
This version intentionally has no admin page. If you later add a channel through a browser-side UI, it can only be stored in that browser's localStorage unless a backend/GitHub API is added.


## Playback troubleshooting
- HTTPS site + `http://...m3u8` stream: browsers block it as mixed content. Use an HTTPS stream or an HTTPS server-side proxy.
- HLS/M3U8 must also allow browser access (CORS) unless it is played natively by a browser that permits it.
- MP4/WebM must be served with a correct `Content-Type` and byte-range support.
- YouTube/Vimeo/Dailymotion URLs use their embed players; arbitrary webpage URLs cannot be played as direct video.
- Autoplay is attempted only after the user opens a channel, which is normally allowed by browsers.
