---
title: Music quickstart
subtitle: Learn how to generate music with Eleven Music.
---

This guide will show you how to generate music with Eleven Music.

<Info>The Eleven Music API is only available to paid users.</Info>

## Using the Eleven Music API

<Steps>
    <Step title="Create an API key">
        [Create an API key in the dashboard here](https://elevenlabs.io/app/settings/api-keys), which you’ll use to securely [access the API](/docs/api-reference/authentication).
        
        Store the key as a managed secret and pass it to the SDKs either as a environment variable via an `.env` file, or directly in your app’s configuration depending on your preference.
        
        ```js title=".env"
        ELEVENLABS_API_KEY=<your_api_key_here>
        ```
        
    </Step>
    <Step title="Install the SDK">
        We'll also use the `dotenv` library to load our API key from an environment variable.
        
        <CodeBlocks>
            ```python
            pip install elevenlabs
            pip install python-dotenv
            ```
        
            ```typescript
            npm install @elevenlabs/elevenlabs-js
            npm install dotenv
            ```
        
        </CodeBlocks>
        
    </Step>
    <Step title="Make the API request">
        Create a new file named `example.py` or `example.mts`, depending on your language of choice and add the following code:

        <CodeBlocks>
        ```python
        # example.py
        from elevenlabs.client import ElevenLabs
        from elevenlabs import play
        import os
        from dotenv import load_dotenv
        load_dotenv()

        elevenlabs = ElevenLabs(
            api_key=os.getenv("ELEVENLABS_API_KEY"),
        )

        track = elevenlabs.music.compose(
            prompt="Create an intense, fast-paced electronic track for a high-adrenaline video game scene. Use driving synth arpeggios, punchy drums, distorted bass, glitch effects, and aggressive rhythmic textures. The tempo should be fast, 130–150 bpm, with rising tension, quick transitions, and dynamic energy bursts.",
            music_length_ms=10000,
        )

        play(track)
        ```

        ```typescript
        // example.mts
        import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
        import "dotenv/config";

        const elevenlabs = new ElevenLabsClient();

        const track = await elevenlabs.music.compose({
          prompt: "Create an intense, fast-paced electronic track for a high-adrenaline video game scene. Use driving synth arpeggios, punchy drums, distorted bass, glitch effects, and aggressive rhythmic textures. The tempo should be fast, 130–150 bpm, with rising tension, quick transitions, and dynamic energy bursts.",
          musicLengthMs: 10000,
        });

        await play(track);
        ```
        </CodeBlocks>
    </Step>
     <Step title="Execute the code">
        <CodeBlocks>
            ```python
            python example.py
            ```

            ```typescript
            npx tsx example.mts
            ```
        </CodeBlocks>

        You should hear the generated music playing.
    </Step>

</Steps>

## Composition plans

A composition plan is a JSON object that describes the music you want to generate in finer detail. It can then be used to generate music with Eleven Music.

Using a plan is optional, but it can be used to generate more complex music by giving you more granular control over each section of the generation.

### Generating a composition plan

A composition plan can be generated from a prompt by using the API.

<CodeBlocks>

    ```python
    from elevenlabs.client import ElevenLabs
    from elevenlabs import play
    import os
    from dotenv import load_dotenv
    load_dotenv()

    elevenlabs = ElevenLabs(
    api_key=os.getenv("ELEVENLABS_API_KEY"),
    )

    composition_plan = elevenlabs.music.composition_plan.create(
        prompt="Create an intense, fast-paced electronic track for a high-adrenaline video game scene. Use driving synth arpeggios, punchy drums, distorted bass, glitch effects, and aggressive rhythmic textures. The tempo should be fast, 130–150 bpm, with rising tension, quick transitions, and dynamic energy bursts.",
        music_length_ms=10000,
    )

    print(composition_plan)
    ```

    ```typescript
    import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
    import "dotenv/config";

    const elevenlabs = new ElevenLabsClient();

    const compositionPlan = await elevenlabs.music.compositionPlan.create({
      prompt: "Create an intense, fast-paced electronic track for a high-adrenaline video game scene. Use driving synth arpeggios, punchy drums, distorted bass, glitch effects, and aggressive rhythmic textures. The tempo should be fast, 130–150 bpm, with rising tension, quick transitions, and dynamic energy bursts.",
      musicLengthMs: 10000,
    });

    console.log(JSON.stringify(compositionPlan, null, 2));
    ```

</CodeBlocks>

The above will generate a composition plan similar to the following:

```json
{
  "positiveGlobalStyles": [
    "electronic",
    "fast-paced",
    "driving synth arpeggios",
    "punchy drums",
    "distorted bass",
    "glitch effects",
    "aggressive rhythmic textures",
    "high adrenaline"
  ],
  "negativeGlobalStyles": ["acoustic", "slow", "minimalist", "ambient", "lo-fi"],
  "sections": [
    {
      "sectionName": "Intro",
      "positiveLocalStyles": [
        "rising synth arpeggio",
        "glitch fx",
        "filtered noise sweep",
        "soft punchy kick building tension"
      ],
      "negativeLocalStyles": ["soft pads", "melodic vocals", "ambient textures"],
      "durationMs": 3000,
      "lines": []
    },
    {
      "sectionName": "Peak Drop",
      "positiveLocalStyles": [
        "full punchy drums",
        "distorted bass stab",
        "aggressive rhythmic hits",
        "rapid arpeggio sequences"
      ],
      "negativeLocalStyles": ["smooth transitions", "clean bass", "slow buildup"],
      "durationMs": 4000,
      "lines": []
    },
    {
      "sectionName": "Final Burst",
      "positiveLocalStyles": [
        "glitch stutter",
        "energy burst vox chopped sample",
        "quick transitions",
        "snare rolls"
      ],
      "negativeLocalStyles": ["long reverb tails", "fadeout", "gentle melodies"],
      "durationMs": 3000,
      "lines": []
    }
  ]
}
```

### Using a composition plan

A composition plan can be used to generate music by passing it to the `compose` method.

<CodeBlocks>
    ```python
    # You can pass in composition_plan or prompt, but not both.
    composition = elevenlabs.music.compose(
        composition_plan=composition_plan,
    )

    play(composition)
    ```

    ```typescript
    // You can pass in compositionPlan or prompt, but not both.
    const composition = await elevenlabs.music.compose({
        compositionPlan,
    });

    await play(composition);
    ```

</CodeBlocks>

## Generating music with details

For each music generation a composition plan is created from the prompt. You can opt to retrieve this plan by using the detailed response endpoint.

<CodeBlocks>

    ```python
    track_details = elevenlabs.music.compose_detailed(
        prompt="Create an intense, fast-paced electronic track for a high-adrenaline video game scene. Use driving synth arpeggios, punchy drums, distorted bass, glitch effects, and aggressive rhythmic textures. The tempo should be fast, 130–150 bpm, with rising tension, quick transitions, and dynamic energy bursts.",
        music_length_ms=10000,
    )

    print(track_details.json) # json contains composition_plan and song_metadata. The composition plan will include lyrics (if applicable)
    print(track_details.filename)
    # track_details.audio contains the audio bytes
    ```

    ```typescript
    const trackDetails = await elevenlabs.music.composeDetailed({
      prompt: 'Create an intense, fast-paced electronic track for a high-adrenaline video game scene. Use driving synth arpeggios, punchy drums, distorted bass, glitch effects, and aggressive rhythmic textures. The tempo should be fast, 30–150 bpm, with rising tension, quick transitions, and dynamic energy bursts.',
      musicLengthMs: 10000,
    });

    console.log(JSON.stringify(trackDetails.json, null, 2)); // json contains composition_plan and song_metadata. The composition plan will include lyrics (if applicable)
    console.log(trackDetails.filename);
    // trackDetails.audio contains the audio bytes
    ```

</CodeBlocks>

## Next steps

Explore the [API reference](/docs/api-reference/music/compose) for more information on the Music API and its options.


---
title: Developer quickstart
subtitle: Learn how to make your first ElevenLabs API request.
---

The ElevenLabs API provides a simple interface to state-of-the-art audio [models](/docs/models) and [features](/docs/api-reference/introduction). Follow this guide to learn how to create lifelike speech with our Text to Speech API. See the [developer guides](/docs/quickstart#explore-our-developer-guides) for more examples with our other products.

## Using the Text to Speech API

<Steps>
    <Step title="Create an API key">
      [Create an API key in the dashboard here](https://elevenlabs.io/app/settings/api-keys), which you’ll use to securely [access the API](/docs/api-reference/authentication).
      
      Store the key as a managed secret and pass it to the SDKs either as a environment variable via an `.env` file, or directly in your app’s configuration depending on your preference.
      
      ```js title=".env"
      ELEVENLABS_API_KEY=<your_api_key_here>
      ```
      
    </Step>
    <Step title="Install the SDK">
      We'll also use the `dotenv` library to load our API key from an environment variable.
      
      <CodeBlocks>
          ```python
          pip install elevenlabs
          pip install python-dotenv
          ```
      
          ```typescript
          npm install @elevenlabs/elevenlabs-js
          npm install dotenv
          ```
      
      </CodeBlocks>
      

      <Note>
        To play the audio through your speakers, you may be prompted to install [MPV](https://mpv.io/)
      and/or [ffmpeg](https://ffmpeg.org/).
      </Note>
    </Step>
    <Step title="Make your first request">
      Create a new file named `example.py` or `example.mts`, depending on your language of choice and add the following code:
       {/* This snippet was auto-generated */}
       <CodeBlocks>
       ```python
       from dotenv import load_dotenv
       from elevenlabs.client import ElevenLabs
       from elevenlabs import play
       import os
       
       load_dotenv()
       
       elevenlabs = ElevenLabs(
         api_key=os.getenv("ELEVENLABS_API_KEY"),
       )
       
       audio = elevenlabs.text_to_speech.convert(
           text="The first move is what sets everything in motion.",
           voice_id="JBFqnCBsd6RMkjVDRZzb",
           model_id="eleven_multilingual_v2",
           output_format="mp3_44100_128",
       )
       
       play(audio)
       
       ```
       
       ```typescript
       import { ElevenLabsClient, play } from '@elevenlabs/elevenlabs-js';
       import 'dotenv/config';
       
       const elevenlabs = new ElevenLabsClient();
       const audio = await elevenlabs.textToSpeech.convert('JBFqnCBsd6RMkjVDRZzb', {
         text: 'The first move is what sets everything in motion.',
         modelId: 'eleven_multilingual_v2',
         outputFormat: 'mp3_44100_128',
       });
       
       await play(audio);
       
       ```
       
       </CodeBlocks>
    </Step>
    <Step title="Run the code">
        <CodeBlocks>
            ```python
            python example.py
            ```

            ```typescript
            npx tsx example.mts
            ```
        </CodeBlocks>

        You should hear the audio play through your speakers.
    </Step>

</Steps>

## Explore our developer guides

Now that you've made your first ElevenLabs API request, you can explore the other products that ElevenLabs offers.

<CardGroup cols={2}>
  <Card
    title="Speech to Text"
    icon="duotone pen-clip"
    href="/docs/cookbooks/speech-to-text/quickstart"
  >
    Convert spoken audio into text
  </Card>
  <Card
    title="Conversational AI"
    icon="duotone comments"
    href="/docs/cookbooks/conversational-ai/quickstart"
  >
    Deploy conversational voice agents
  </Card>
  <Card title="Music" icon="duotone music" href="/docs/cookbooks/music/quickstart">
    Generate studio-quality music
  </Card>
  <Card
    title="Voice cloning"
    icon="duotone clone"
    href="/docs/cookbooks/voices/instant-voice-cloning"
  >
    Clone a voice
  </Card>
  <Card title="Sound effects" icon="duotone explosion" href="/docs/cookbooks/sound-effects">
    Generate sound effects from text
  </Card>
  <Card title="Voice Changer" icon="duotone message-pen" href="/docs/cookbooks/voice-changer">
    Transform the voice of an audio file
  </Card>
  <Card title="Voice Isolator" icon="duotone ear" href="/docs/cookbooks/voice-isolator">
    Isolate background noise from audio
  </Card>
  <Card title="Voice Design" icon="duotone paint-brush" href="/docs/cookbooks/voices/voice-design">
    Generate voices from a single text prompt
  </Card>
  <Card title="Dubbing" icon="duotone language" href="/docs/cookbooks/dubbing">
    Dub audio/video from one language to another
  </Card>
  <Card
    title="Forced Alignment"
    icon="duotone objects-align-left"
    href="/docs/cookbooks/forced-alignment"
  >
    Generate time-aligned transcripts for audio
  </Card>
</CardGroup>

