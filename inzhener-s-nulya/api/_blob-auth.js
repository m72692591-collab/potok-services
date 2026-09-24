export function blobAuth(){
  if(process.env.BLOB_READ_WRITE_TOKEN)return{token:process.env.BLOB_READ_WRITE_TOKEN};
  if(process.env.BLOB_STORE_ID&&process.env.VERCEL_OIDC_TOKEN){
    return{storeId:process.env.BLOB_STORE_ID,oidcToken:process.env.VERCEL_OIDC_TOKEN};
  }
  return{};
}
