// Simple MIDI test utility
export const testMidiSupport = () => {
  console.log('=== MIDI Support Test ===');
  
  // Check if Web MIDI API is available
  if (!navigator.requestMIDIAccess) {
    console.error('❌ Web MIDI API is not supported in this browser');
    return false;
  }
  
  console.log('✅ Web MIDI API is supported');
  return true;
};

export const testMidiConnection = async () => {
  console.log('=== MIDI Connection Test ===');
  
  try {
    const access = await navigator.requestMIDIAccess();
    const inputs = Array.from(access.inputs.values());
    const outputs = Array.from(access.outputs.values());
    
    console.log(`Found ${inputs.length} MIDI input(s):`);
    inputs.forEach((input, index) => {
      console.log(`  ${index + 1}. ${input.name} (${input.manufacturer}) - ${input.state}`);
    });
    
    console.log(`Found ${outputs.length} MIDI output(s):`);
    outputs.forEach((output, index) => {
      console.log(`  ${index + 1}. ${output.name} (${output.manufacturer}) - ${output.state}`);
    });
    
    if (inputs.length === 0) {
      console.warn('⚠️  No MIDI input devices found. Please connect a MIDI controller.');
      return false;
    }
    
    // Set up test listener for the first input
    const firstInput = inputs[0];
    console.log(`🎹 Setting up test listener for: ${firstInput.name}`);
    
    firstInput.onmidimessage = (event) => {
      const [status, data1, data2] = event.data;
      const messageType = status & 0xF0;
      const channel = status & 0x0F;
      
      switch (messageType) {
        case 0x90: // Note On
          if (data2 > 0) {
            console.log(`🎵 Note On: ${data1} velocity: ${data2} (channel: ${channel})`);
          } else {
            console.log(`🎵 Note Off: ${data1} (channel: ${channel})`);
          }
          break;
        case 0x80: // Note Off
          console.log(`🎵 Note Off: ${data1} (channel: ${channel})`);
          break;
        case 0xB0: // Control Change
          console.log(`🎛️  Control Change: ${data1} value: ${data2} (channel: ${channel})`);
          break;
        case 0xE0: { // Pitch Bend
          const pitchValue = ((data2 << 7) | data1);
          console.log(`🎚️  Pitch Bend: ${pitchValue} (channel: ${channel})`);
          break;
        }
        default:
          console.log(`📟 MIDI Message: ${status} ${data1} ${data2}`);
      }
    };
    
    console.log('✅ MIDI test listener setup complete. Play your MIDI controller to see messages.');
    return true;
    
  } catch (error) {
    console.error('❌ MIDI connection test failed:', error);
    return false;
  }
};

// Tests are available but not auto-run
// To run tests manually, use: window.midiTest.testMidiSupport() or window.midiTest.testMidiConnection()

// Export for manual testing
(window as any).midiTest = {
  testMidiSupport,
  testMidiConnection,
}; 