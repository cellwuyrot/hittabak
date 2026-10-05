export function publicBusinessConfig(){
  const legalEntityName=process.env.LEGAL_ENTITY_NAME?.trim(); const supportEmail=process.env.PUBLIC_SUPPORT_EMAIL?.trim(); const supportPhone=process.env.PUBLIC_SUPPORT_PHONE?.trim();
  if(!legalEntityName) console.error("Owner configuration error: LEGAL_ENTITY_NAME is required for legal pages");
  return {legalEntityName,supportEmail,supportPhone};
}
