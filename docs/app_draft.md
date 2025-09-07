Webcam AI App with the Ideogram character model

Screen shot from webcam or upload in UI

character ref image stored in cwd /images

Pick number of scenes (drop down) scene 1 - 5 in UI

Describe your dream video in short in UI

Click Generate button

UI must show some progress or estimated progress of completion of video

OpenAI GPT-5 nano will write the scene 1 to n prompts for ideogram character

OpenAI GPT-5 nano will write a Voice Over scripts that fits the scenes

OpenAI GPT-5 nano will write the fitting Instrumental Music prompt for the video

OpenAI GPT-5 nano will write the video prompts for each scene for kling.21

Replicate Ideogram will generate the n amounts of image for each scene by chaining rolling ref images:

- scene 1 is generated from uploaded or screenshot ref image
- scene 2 uses scene1 image as ref image , and so on scene 3 uses scene 2 as ref…

Scene images are saved in /images

Now generate video from each image using kling 2.1 standar + generated image prompt

saved videos to /video in cwd

merge all video files in order using FFMPEG

now turn the generated voice over if any to .mp3 using Eleven Labs TTS

generate the fitting instrumental music from the generated music prompt using Eleven Labs music

Add music on vol 20% and VO if any on 100% to merged video using FFMPEG

Display FINAL video in UI with a player and option to download