// Remove quiet lead-in from the decoded calendar recording, without changing
// the original file or the speed/pitch of the tear itself.
function trimCalendarLeadIn(buffer, audioContext) {
  const windowSize = Math.max(1, Math.round(buffer.sampleRate * .005));
  let onset = 0;
  for (let start = 0; start < buffer.length; start += windowSize) {
    const end = Math.min(buffer.length, start + windowSize);
    let loudestRms = 0;
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      const samples = buffer.getChannelData(channel);
      let energy = 0;
      for (let i = start; i < end; i++) energy += samples[i] * samples[i];
      loudestRms = Math.max(loudestRms, Math.sqrt(energy / (end - start)));
    }
    if (loudestRms >= .01) {
      onset = Math.max(0, start - windowSize);
      break;
    }
  }
  if (!onset) return buffer;
  const trimmed = audioContext.createBuffer(buffer.numberOfChannels, buffer.length - onset, buffer.sampleRate);
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    trimmed.copyToChannel(buffer.getChannelData(channel).subarray(onset), channel);
  }
  return trimmed;
}
