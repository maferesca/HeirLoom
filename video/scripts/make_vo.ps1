# Generates the voiceover lines with the Windows offline voice (Microsoft Zira, en-US). No network.
# Output: public/vo/NN.wav. Usage: powershell -ExecutionPolicy Bypass -File scripts/make_vo.ps1 [-Rate 1]
param([int]$Rate = 1, [int]$IntroRate = 2)
Add-Type -AssemblyName System.Speech
$lines = @(
  "My grandfather is a farmer.",
  "He inspired me to build Heirloom around one question:",
  "What should I plant next?",
  "In Hes-soos Carranza, Heirloom combines NASA climate records, regional soil estimates, and what farmers know about their land.",
  "It shows what you could plant each cycle,",
  "why the option fits the constraints you shared,",
  "and what to check before you decide."
)
$out = Join-Path (Get-Location) "public\vo"
New-Item -ItemType Directory -Force $out | Out-Null
$i = 0
foreach ($l in $lines) {
  $s = New-Object System.Speech.Synthesis.SpeechSynthesizer
  $s.SelectVoice("Microsoft Zira Desktop")
  $s.Rate = $(if ($i -lt 3) { $IntroRate } else { $Rate })
  $fmt = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(44100, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
  $f = Join-Path $out ("{0:D2}.wav" -f $i)
  $s.SetOutputToWaveFile($f, $fmt)
  $s.Speak($l)
  $s.Dispose()
  $i++
}
Write-Output "ok $i lines"
