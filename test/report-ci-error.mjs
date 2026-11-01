if(process.env.GITHUB_ACTIONS==='true'){
  process.on('uncaughtExceptionMonitor',error=>{
    const message=String(error.stack||error).replaceAll('%','%25').replaceAll('\r','%0D').replaceAll('\n','%0A');
    console.error('::error::'+message);
  });
}
