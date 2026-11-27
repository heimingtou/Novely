param([Parameter(Mandatory=$true)][ValidateSet('prepare','preflight','init','dry-run','apply','smoke')][string]$Phase,[switch]$SignIn)
$ErrorActionPreference='Stop'
$taskRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$names=@('NOVELY_STAGING_DB_PASSWORD','NOVELY_STAGING_SERVICE_KEY','NOVELY_STAGING_PUBLIC_KEY','NOVELY_STAGING_APPROVAL','NOVELY_STAGING_USER_JWT','NOVELY_STAGING_TEST_EMAIL','NOVELY_STAGING_TEST_PASSWORD')
$saved=@{}
foreach ($name in $names) { $saved[$name]=[Environment]::GetEnvironmentVariable($name,'Process') }
function Set-TaskSecret([string]$Name,[string]$Prompt) {
  $secret=Read-Host $Prompt -AsSecureString
  $ptr=[Runtime.InteropServices.Marshal]::SecureStringToBSTR($secret)
  try { [Environment]::SetEnvironmentVariable($Name,[Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr),'Process') }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr); $secret.Dispose() }
}
try {
  if ($env:NODE_TLS_REJECT_UNAUTHORIZED -eq '0') { throw 'TLS verification must not be disabled' }
  if ($env:NODE_EXTRA_CA_CERTS -and -not (Test-Path -LiteralPath $env:NODE_EXTRA_CA_CERTS -PathType Leaf)) {
    throw 'NODE_EXTRA_CA_CERTS must point to an existing trusted CA file before Node starts'
  }
  if ($Phase -ne 'prepare') {
    $cfg=Get-Content -LiteralPath (Join-Path $taskRoot 'backend/.local/staging/config.json') -Raw | ConvertFrom-Json
    # This validation is offline, before prompting secrets or opening any socket.
    & node --input-type=module -e "import {target} from './backend/scripts/staging.mjs'; import fs from 'node:fs'; target(JSON.parse(fs.readFileSync('backend/.local/staging/config.json','utf8')));"
    if ($LASTEXITCODE -ne 0) { throw 'Invalid/non-staging target configuration' }
    if ($Phase -notin @('preflight','smoke')) {
      $approval=Read-Host "Confirm staging action: type $($Phase.ToUpper()) $($cfg.projectRef)"
      [Environment]::SetEnvironmentVariable('NOVELY_STAGING_APPROVAL',$approval,'Process')
    }
    Set-TaskSecret 'NOVELY_STAGING_DB_PASSWORD' 'Staging database password (hidden)'
    if ($Phase -eq 'smoke') {
      Set-TaskSecret 'NOVELY_STAGING_SERVICE_KEY' 'Staging secret/service role API key (hidden)'
      Set-TaskSecret 'NOVELY_STAGING_PUBLIC_KEY' 'Staging publishable/anon API key (hidden)'
      if ($SignIn) {
        [Environment]::SetEnvironmentVariable('NOVELY_STAGING_TEST_EMAIL',(Read-Host 'Staging Supabase Auth test account email'),'Process')
        Set-TaskSecret 'NOVELY_STAGING_TEST_PASSWORD' 'Staging Auth test account password, not database password (hidden)'
        # Capture the SDK access token in memory; never print it or save a session.
        $loginScript=@'
import fs from 'node:fs';
import {createClient} from '@supabase/supabase-js';
import {target} from './backend/scripts/staging.mjs';
try {
  const url=target(JSON.parse(fs.readFileSync('backend/.local/staging/config.json','utf8')));
  const client=createClient(url,process.env.NOVELY_STAGING_PUBLIC_KEY,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  const {data,error}=await client.auth.signInWithPassword({email:process.env.NOVELY_STAGING_TEST_EMAIL,password:process.env.NOVELY_STAGING_TEST_PASSWORD});
  if(error||!data.session)throw new Error('Sign-in failed');
  process.stdout.write(data.session.access_token);
} catch {console.error('Staging Auth sign-in failed; check the test account email, password and email confirmation.');process.exitCode=1;}
'@
        $accessToken=& node --input-type=module -e $loginScript
        if ($LASTEXITCODE -ne 0) { throw 'Could not obtain staging authenticated access token' }
        [Environment]::SetEnvironmentVariable('NOVELY_STAGING_USER_JWT',$accessToken,'Process')
        $accessToken=$null
        [Environment]::SetEnvironmentVariable('NOVELY_STAGING_TEST_PASSWORD',$null,'Process')
      } else {
        Set-TaskSecret 'NOVELY_STAGING_USER_JWT' 'Optional staging authenticated access JWT; Enter to mark HTTP authenticated NOT TESTED'
      }
    }
  }
  & node (Join-Path $PSScriptRoot 'staging.mjs') $Phase
  if ($LASTEXITCODE -ne 0) { throw 'Staging step failed; see aggregate result log' }
} finally {
  foreach ($name in $names) { [Environment]::SetEnvironmentVariable($name,$saved[$name],'Process') }
}
