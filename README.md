# Actor App - AI Video Generation

Generate AI videos with customizable actors, voice synthesis, and automated video production using multiple AI services.

## Features

- **AI Image Generation**: Create custom actors using Ideogram
- **Voice Synthesis**: Generate realistic speech with ElevenLabs
- **Video Generation**: Create videos using Kling AI
- **Webcam Integration**: Capture images for actor creation
- **Real-time Processing**: Monitor generation progress
- **Multi-scene Support**: Create videos with multiple scenes

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- FFmpeg (for video processing)

### FFmpeg Installation

**macOS:**
```bash
brew install ffmpeg
```

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install ffmpeg
```

**Windows:**
Download from [ffmpeg.org](https://ffmpeg.org/download.html) and add to PATH.

## API Keys Required

You'll need API keys from these services:

1. **OpenAI** - [Get API key](https://platform.openai.com/api-keys)
2. **ElevenLabs** - [Get API key](https://elevenlabs.io/)
3. **Replicate** - [Get API key](https://replicate.com/)
4. **Fal.ai** - [Get API key](https://fal.ai/)

## Installation

1. **Clone the repository:**
```bash
git clone <repository-url>
cd actor_app
```

2. **Install dependencies:**
```bash
# Install root dependencies
npm install

# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

3. **Set up environment variables:**
```bash
# Copy the example file
cp .env.example .env

# Edit .env and add your API keys
nano .env
```

Update your `.env` file with real API keys:
```env
ELEVENLABS_API_KEY=your_elevenlabs_api_key
REPLICATE_API_KEY=your_replicate_api_key
OPENAI_API_KEY=your_openai_api_key
FAL_API_KEY=your_fal_api_key

# Server Configuration
PORT=5000
NODE_ENV=development

# File Storage Paths
IMAGES_DIR=./images
VIDEO_DIR=./video
RUNS_DIR=./runs

# Processing Configuration
MAX_CONCURRENT_JOBS=1
CLEANUP_DAYS=7
DEFAULT_RESOLUTION=720p
MAX_SCENES=5
DEFAULT_SCENES=3
SCENE_DURATION_SECONDS=5
```

## Running the Application

### Development Mode

1. **Start the server:**
```bash
cd server
npm run dev
```

2. **Start the client (in a new terminal):**
```bash
cd client
npm start
```

3. **Open your browser:**
Navigate to `http://localhost:3000`

### Production Mode

1. **Build the client:**
```bash
cd client
npm run build
```

2. **Start the server:**
```bash
cd server
npm start
```

## Project Structure

```
actor_app/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # React components
│   │   ├── services/       # API services
│   │   └── types/          # TypeScript types
│   └── build/              # Built frontend (generated)
├── server/                 # Node.js backend
│   ├── src/
│   │   ├── routes/         # API routes
│   │   ├── services/       # AI service integrations
│   │   └── utils/          # Utility functions
│   └── dist/               # Compiled TypeScript (generated)
├── images/                 # Generated images (created on run)
├── video/                  # Generated videos (created on run)
├── runs/                   # Generation sessions (created on run)
└── logs/                   # Application logs (created on run)
```

## Usage

1. **Create Actor**: Use the image upload or webcam to create an actor image
2. **Configure Video**: Set script, voice settings, and video parameters
3. **Generate**: Click generate to start the AI video creation process
4. **Monitor**: Watch real-time progress in the interface
5. **Download**: Download your completed video

## API Endpoints

- `POST /api/generate` - Start video generation
- `GET /api/status/:sessionId` - Check generation status
- `GET /api/download/:filename` - Download generated video

## Troubleshooting

### Common Issues

**FFmpeg not found:**
- Ensure FFmpeg is installed and in your PATH
- Restart terminal after installation

**API key errors:**
- Verify all API keys are correctly set in `.env`
- Check API key permissions and quotas

**Port already in use:**
- Change the PORT in `.env` to a different value
- Kill processes using the port: `lsof -ti:5000 | xargs kill`

**Build errors:**
- Clear node_modules: `rm -rf node_modules && npm install`
- Clear build caches: `npm run clean` (if available)

### Logs

Check application logs for detailed error information:
- Server logs: `server/logs/combined.log`
- Error logs: `server/logs/error.log`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.# face_appppppp
