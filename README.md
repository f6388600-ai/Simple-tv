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
