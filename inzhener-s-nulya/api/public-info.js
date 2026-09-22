import{json}from'./_shared.js';
export default function handler(req,res){
  return json(res,200,{
    brand:'Инженер с нуля',
    legalName:process.env.BUSINESS_LEGAL_NAME||'ИП Григоров Михаил Владимирович',
    inn:process.env.BUSINESS_INN||'640100982708',
    ogrn:process.env.BUSINESS_OGRN||'326045700090104',
    email:process.env.BUSINESS_CONTACT_EMAIL||'',
    phone:process.env.BUSINESS_CONTACT_PHONE||''
  })
}
