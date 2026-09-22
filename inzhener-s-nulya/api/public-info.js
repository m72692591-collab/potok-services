import{json}from'./_shared.js';

export default function handler(req,res){
  return json(res,200,{
    brand:'Инженер с нуля',
    legalName:process.env.BUSINESS_LEGAL_NAME||'ИП Григоров Михаил Владимирович',
    inn:process.env.BUSINESS_INN||'640100982708',
    ogrn:process.env.BUSINESS_OGRN||'326045700090104',
    email:process.env.BUSINESS_CONTACT_EMAIL||'grigorov555@mail.ru',
    phone:process.env.BUSINESS_CONTACT_PHONE||'8-969-621-34-70',
    address:process.env.BUSINESS_ADDRESS||'с. Александров Гай, ул. Дома Газовиков, д. 21',
    hours:process.env.BUSINESS_HOURS||'Ежедневно, 09:00–20:00 по московскому времени'
  });
}