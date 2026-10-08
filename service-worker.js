self.addEventListener('install',event=>{event.waitUntil(self.skipWaiting());});
self.addEventListener('activate',event=>{event.waitUntil(self.clients.claim());});
self.addEventListener('push',event=>{
 let payload={};
 try{ payload=event.data?event.data.json():{}; }
 catch(_){ payload={body:event.data?.text()||'A gentle reminder to drink some water.'}; }
 const title=payload.title||'VITALIS hydration reminder';
 const options={body:payload.body||'A gentle check-in: have a glass of water if you need one.',tag:payload.tag||'vitalis-hydration',data:payload.data||{url:'/'}};
 event.waitUntil(self.registration.showNotification(title,options));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 const target=new URL(event.notification.data?.url||'/',self.location.origin);
 event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async clients=>{
  for(const client of clients){
   if(new URL(client.url).origin===self.location.origin){
    if('navigate' in client) await client.navigate(target.href);
    return client.focus();
   }
  }
  return self.clients.openWindow(target.href);
 }));
});
