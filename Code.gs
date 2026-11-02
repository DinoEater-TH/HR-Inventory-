/* Office Inventory Dashboard - Google Apps Script
 * ใช้กับ Spreadsheet ID ที่ระบุไว้ด้านล่าง ไม่ต้องเขียนโค้ดเพิ่ม
 */
const SPREADSHEET_ID = '11voKZ1nFezcgt5Jz2SaBNs4-th7V7xrNKZ2fkz1Fsqo';
const TABLES = {
  Inventory: ['ItemID','Code','Name','Category','Unit','Quantity','MinStock','Price','Location','Type','Status','UpdatedAt','Notes'],
  Transactions: ['TxnID','Date','Type','ItemID','Code','Name','Quantity','Unit','Requester','Department','Note','CreatedAt'],
  Assets: ['AssetID','AssetCode','Name','Category','Department','Location','Responsible','Status','PurchaseDate','Cost','Note','UpdatedAt']
};

/* ===== Apps Script = API รับ–ส่งข้อมูลเท่านั้น (JSON) =====
 * หน้าเว็บ (index.html / withdraw.html) จะเรียกผ่าน fetch ไปยัง URL นี้
 * รูปแบบ: GET  ?action=xxx&data={json}&callback=cb   (callback = JSONP สำรอง)
 *         POST { "action":"xxx", "data":{...} }        (Content-Type: text/plain)
 */
function doGet(e) {
  const p = (e && e.parameter) || {};
  return handle_({ action: p.action, data: p.data, callback: p.callback });
}
function doPost(e) {
  let body = {};
  try { body = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (err) { body = {}; }
  const p = (e && e.parameter) || {};
  return handle_({ action: body.action, data: body.data, callback: p.callback });
}
function handle_(req) {
  const cb = String(req.callback || '');
  let out;
  try {
    const action = String(req.action || '');
    if (!action) throw Error('ไม่ระบุ action');
    let data = req.data;
    if (typeof data === 'string') data = data ? JSON.parse(data) : null;
    out = { ok: true, result: run_(action, data) };
  } catch (err) {
    out = { ok: false, error: String((err && err.message) || err) };
  }
  if (cb && /^[A-Za-z0-9_$]{1,64}$/.test(cb)) {
    return ContentService.createTextOutput('/**/' + cb + '(' + JSON.stringify(out) + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}
function run_(action, data) {
  switch (action) {
    case 'getDashboard': return getDashboard();
    case 'getItemList': return getItemList();
    case 'getNextItemCode': return getNextItemCode();
    case 'getNextAssetCode': return getNextAssetCode();
    case 'saveItem': return saveItem(data || {});
    case 'deleteItem': return deleteItem(data);
    case 'saveAsset': return saveAsset(data || {});
    case 'deleteAsset': return deleteAsset(data);
    case 'recordTransaction': return recordTransaction(data || {});
    case 'recordWithdrawalBatch': return recordWithdrawalBatch(data || {});
    case 'importItems': return importItems(data);
    case 'importItemsFromUrl': return importItemsFromUrl(data);
    case 'importItemsFromText': return importItemsFromText(data);
    case 'setup': return setup();
    default: throw Error('ไม่รู้จัก action: ' + action);
  }
}
function ss_() { return SpreadsheetApp.openById(SPREADSHEET_ID); }
function padCode_(v) {
  const s=String(v===undefined||v===null?'':v).trim();
  if(!s) return '';
  const m=s.match(/^0*(\d+)$/);
  if(!m) return s;
  const n=parseInt(m[1],10);
  return n<1?'0001':(n<10?'000':n<100?'00':n<1000?'0':'')+n;
}
function nextCode_(rows, key) {
  let max=0;
  rows.forEach(r=>{const m=String(r[key]||'').trim().match(/^0*(\d+)$/);if(m){const n=parseInt(m[1],10);if(n>max)max=n;}});
  return padCode_(max+1);
}
function setup() {
  const book = ss_();
  Object.keys(TABLES).forEach(n => { let s=book.getSheetByName(n); if(!s) s=book.insertSheet(n); if(s.getLastRow()===0) s.appendRow(TABLES[n]); s.setFrozenRows(1); });
  if (!book.getSheetByName('Settings')) { const s=book.insertSheet('Settings'); s.appendRow(['Key','Value']); s.appendRow(['LowStockDefault','5']); }
  importExisting_();
  normalizeCodes_('Inventory','Code');
  normalizeCodes_('Assets','AssetCode');
  return 'พร้อมใช้งาน';
}
function normalizeCodes_(table, key) {
  const s=sheet_(table), last=s.getLastRow();
  const col=TABLES[table].indexOf(key)+1;
  if(col<1) return;
  s.getRange(2,col,Math.max(1,s.getMaxRows()-1),1).setNumberFormat('@');
  if(last<2) return;
  const rng=s.getRange(2,col,last-1,1), vals=rng.getValues();
  let changed=false, max=0;
  vals.forEach(r=>{const m=String(r[0]||'').trim().match(/^0*(\d+)$/);if(m){const n=parseInt(m[1],10);if(n>max)max=n;}});
  const nextVals=vals.map(r=>{
    const cur=String(r[0]||'').trim();
    const padded=cur?padCode_(cur):padCode_(++max);
    if(padded!==r[0]) changed=true;
    return [padded];
  });
  if(changed) rng.setValues(nextVals);
}
function sheet_(n) { const s=ss_().getSheetByName(n); if(!s) throw Error('กรุณากด setup ก่อน'); return s; }
function rows_(n) { const v=sheet_(n).getDataRange().getValues(); if(v.length<2)return []; return v.slice(1).map(r=>v[0].reduce((o,h,i)=>(o[h]=r[i],o),{})); }
function clean_(v) { return v instanceof Date ? v.toISOString() : (v==null?'':v); }
function json_(v) { return JSON.parse(JSON.stringify(v,(_,x)=>clean_(x))); }
function num_(v) { const n=Number(v); return isNaN(n)?0:n; }
function id_(p) { return p+Utilities.getUuid().replace(/-/g,'').slice(0,10).toUpperCase(); }
function append_(n,o) { sheet_(n).appendRow(TABLES[n].map(k=>o[k]===undefined?'':o[k])); }
function findRow_(n,key,value) { const s=sheet_(n), v=s.getDataRange().getValues(), c=v[0].indexOf(key); for(let i=1;i<v.length;i++)if(String(v[i][c])===String(value))return i+1; return -1; }
function update_(n,key,value,o) { const s=sheet_(n), v=s.getDataRange().getValues(), h=v[0], c=h.indexOf(key); for(let i=1;i<v.length;i++)if(String(v[i][c])===String(value)){Object.keys(o).forEach(k=>{const j=h.indexOf(k);if(j>=0)s.getRange(i+1,j+1).setValue(o[k]);});return;} throw Error('ไม่พบข้อมูล'); }

function getDashboard() {
  setup();
  const inventory=rows_('Inventory').map(x=>Object.assign({},x,{Code:padCode_(x.Code)})), tx=rows_('Transactions'), assets=rows_('Assets').map(x=>Object.assign({},x,{AssetCode:padCode_(x.AssetCode)}));
  const low=inventory.filter(x=>num_(x.Quantity)<=num_(x.MinStock)&&String(x.Status||'ใช้งาน')!=='ยกเลิก');
  const totalQty=inventory.reduce((a,x)=>a+num_(x.Quantity),0), totalValue=inventory.reduce((a,x)=>a+num_(x.Quantity)*num_(x.Price),0);
  const cats={}; inventory.forEach(x=>cats[x.Category||'ไม่ระบุ']=(cats[x.Category||'ไม่ระบุ']||0)+num_(x.Quantity));
  return json_({inventory,assets,transactions:tx.slice(-100).reverse(),low,categories:cats,nextItemCode:nextCode_(inventory,'Code'),nextAssetCode:nextCode_(assets,'AssetCode'),summary:{items:inventory.length,quantity:totalQty,value:totalValue,assets:assets.length,low:low.length}});
}
function getNextItemCode() { setup(); return nextCode_(rows_('Inventory'),'Code'); }
function saveItem(item) {
  setup(); const now=new Date();
  const code=padCode_(item.Code)||nextCode_(rows_('Inventory'),'Code');
  const o={ItemID:item.ItemID||id_('IT'),Code:code,Name:String(item.Name||'').trim(),Category:item.Category||'ทั่วไป',Unit:item.Unit||'ชิ้น',Quantity:num_(item.Quantity),MinStock:num_(item.MinStock),Price:num_(item.Price),Location:item.Location||'',Type:item.Type||'พัสดุ',Status:item.Status||'ใช้งาน',UpdatedAt:now,Notes:item.Notes||''};
  if(!o.Name)throw Error('กรุณาระบุชื่อรายการ');
  if(item.ItemID)update_('Inventory','ItemID',item.ItemID,o);else append_('Inventory',o); return getDashboard();
}
function recordTransaction(t) {
  setup(); const item=rows_('Inventory').find(x=>String(x.ItemID)===String(t.ItemID)); if(!item)throw Error('ไม่พบรายการพัสดุ');
  const q=num_(t.Quantity); if(q<=0)throw Error('จำนวนต้องมากกว่า 0'); const type=String(t.Type||'IN').toUpperCase(); let next=num_(item.Quantity);
  if(type==='OUT'){if(q>next)throw Error('จำนวนคงเหลือไม่พอ');next-=q;}else if(type==='IN')next+=q;else if(type==='ADJUST')next=q;else throw Error('ประเภทรายการไม่ถูกต้อง');
  update_('Inventory','ItemID',item.ItemID,{Quantity:next,UpdatedAt:new Date()});
  append_('Transactions',{TxnID:id_('TX'),Date:t.Date?new Date(t.Date):new Date(),Type:type,ItemID:item.ItemID,Code:padCode_(item.Code),Name:item.Name,Quantity:q,Unit:item.Unit,Requester:t.Requester||'',Department:t.Department||'',Note:t.Note||'',CreatedAt:new Date()});
  return t.light ? { saved: true, name: item.Name, remaining: next, unit: item.Unit, data: getItemList() } : getDashboard();
}
// บันทึกการเบิกหลายรายการพร้อมกัน (หน้าเบิกของ) — ตรวจสต็อกครบทุกรายการก่อนเขียนข้อมูล
function recordWithdrawalBatch(p) {
  setup();
  const list = p && Array.isArray(p.items) ? p.items : [];
  if (!list.length) throw Error('กรุณาเพิ่มรายการพัสดุอย่างน้อย 1 รายการ');
  const inv = rows_('Inventory');
  // รวมจำนวนของรายการเดียวกันกัน (กันนับซ้ำ)
  const agg = {};
  list.forEach(li => { const k = String(li.ItemID); agg[k] = (agg[k] || 0) + num_(li.Quantity); });
  const plan = Object.keys(agg).map(k => {
    const item = inv.find(x => String(x.ItemID) === k);
    if (!item) throw Error('ไม่พบรายการพัสดุในคลัง');
    const q = agg[k];
    if (q <= 0) throw Error('จำนวนต้องมากกว่า 0');
    const cur = num_(item.Quantity);
    if (q > cur) throw Error(item.Name + ' คงเหลือไม่พอ (เหลือ ' + cur + ' ' + item.Unit + ')');
    return { item: item, q: q, next: cur - q };
  });
  const now = new Date();
  const req = String(p.Requester || '').trim();
  const dept = p.Department || '';
  const note = p.Note || '';
  plan.forEach(function (row) {
    update_('Inventory', 'ItemID', row.item.ItemID, { Quantity: row.next, UpdatedAt: now });
    append_('Transactions', { TxnID: id_('TX'), Date: now, Type: 'OUT', ItemID: row.item.ItemID, Code: padCode_(row.item.Code), Name: row.item.Name, Quantity: row.q, Unit: row.item.Unit, Requester: req, Department: dept, Note: note, CreatedAt: now });
  });
  return { saved: true, count: plan.length, receipt: plan.map(function (r) { return { Code: padCode_(r.item.Code), Name: r.item.Name, Quantity: r.q, Unit: r.item.Unit, Remaining: r.next }; }), data: getItemList() };
}
// ข้อมูลแบบเบาสำหรับหน้าเบิกของ (ไม่เปิดเผยข้อมูลจัดการคลัง)
function getItemList() {
  setup();
  const inventory = rows_('Inventory').map(x=>({ItemID:x.ItemID,Code:padCode_(x.Code),Name:x.Name,Quantity:num_(x.Quantity),Unit:x.Unit}));
  const transactions = rows_('Transactions').slice(-20).reverse();
  return json_({inventory, transactions});
}
function getNextAssetCode() { setup(); return nextCode_(rows_('Assets'),'AssetCode'); }
function saveAsset(a) {
  setup();
  const name=String(a.Name||'').trim();
  if(!name)throw Error('กรุณาระบุชื่อครุภัณฑ์');
  const code=padCode_(a.AssetCode)||nextCode_(rows_('Assets'),'AssetCode');
  const o={AssetID:a.AssetID||id_('AS'),AssetCode:code,Name:name,Category:a.Category||'ครุภัณฑ์สำนักงาน',Department:a.Department||'',Location:a.Location||'',Responsible:a.Responsible||'',Status:a.Status||'ใช้งาน',PurchaseDate:a.PurchaseDate?new Date(a.PurchaseDate):'',Cost:num_(a.Cost),Note:a.Note||'',UpdatedAt:new Date()};
  if(a.AssetID)update_('Assets','AssetID',a.AssetID,o);else append_('Assets',o);
  return getDashboard();
}
function deleteItem(id) { const r=findRow_('Inventory','ItemID',id);if(r<0)throw Error('ไม่พบข้อมูล');sheet_('Inventory').deleteRow(r);return getDashboard(); }
function deleteAsset(id) { const r=findRow_('Assets','AssetID',id);if(r<0)throw Error('ไม่พบข้อมูล');sheet_('Assets').deleteRow(r);return getDashboard(); }
function importItems(data) {
  setup();
  if (!Array.isArray(data) || !data.length) throw Error('ไม่พบข้อมูลในไฟล์');
  const inv=rows_('Inventory'), existing=inv.map(x=>padCode_(x.Code)).filter(Boolean);
  let max=0; inv.forEach(r=>{const m=String(r.Code||'').trim().match(/^0*(\d+)$/);if(m){const n=parseInt(m[1],10);if(n>max)max=n;}});
  let added=0,skipped=0;
  data.forEach(r=>{const name=String(r.Name||r['ชื่อรายการ']||r['รายการ']||r['ชื่อพัสดุ']||'').trim();if(!name){skipped++;return;}let code=padCode_(r.Code||r['รหัส']||r['รหัสพัสดุ']||r['ลำดับ']||'');if(code&&existing.indexOf(code)>=0){skipped++;return;}if(!code){code=padCode_(++max);}else{const m=code.match(/^0*(\d+)$/);if(m&&parseInt(m[1],10)>max)max=parseInt(m[1],10);}append_('Inventory',{ItemID:id_('IT'),Code:code,Name:name,Category:r.Category||r['หมวดหมู่']||r['ประเภท']||'ทั่วไป',Unit:r.Unit||r['หน่วย']||'ชิ้น',Quantity:num_(r.Quantity||r['จำนวน']||r['คงเหลือ']),MinStock:num_(r.MinStock||r['ขั้นต่ำ']||5),Price:num_(r.Price||r['ราคา']||r['ราคาต่อหน่วย']),Location:r.Location||r['สถานที่']||r['จุดเก็บ']||'',Type:r.Type||'พัสดุ',Status:'ใช้งาน',UpdatedAt:new Date(),Notes:r.Notes||r['หมายเหตุ']||''});if(code)existing.push(code);added++;});
  return {added,skipped,data:getDashboard()};
}
function importItemsFromUrl(url) {
  url=String(url||'').trim();
  if(!url) throw Error('กรุณาระบุลิงก์ไฟล์');
  // รองรับ Google Sheets URL โดยแปลงเป็น CSV export อัตโนมัติ
  const m=url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if(m) {
    const g=url.match(/[#&?]gid=(\d+)/), book=SpreadsheetApp.openById(m[1]);
    const sh=g?book.getSheets().find(s=>String(s.getSheetId())===g[1]):book.getSheets()[0];
    if(!sh) throw Error('ไม่พบแท็บตาม gid ในลิงก์');
    const v=sh.getDataRange().getDisplayValues();
    if(v.length<2) throw Error('ไม่พบข้อมูลในแท็บนี้');
    const h=v[0].map(x=>String(x).trim());
    return importItems(v.slice(1).filter(r=>r.some(x=>String(x).trim())).map(r=>{const o={};h.forEach((k,i)=>o[k]=r[i]||'');return o;}));
  }
  const response=UrlFetchApp.fetch(url,{followRedirects:true,muteHttpExceptions:true});
  if(response.getResponseCode()>=400) throw Error('เปิดลิงก์ไม่ได้ กรุณาตรวจสอบสิทธิ์การเข้าถึง');
  const text=response.getContentText('UTF-8').replace(/^\uFEFF/,'');
  const data=parseCsv_(text);
  return importItems(data);
}
function importItemsFromText(text) { return importItems(parseCsv_(String(text||'').replace(/^\uFEFF/,''))); }
function parseCsv_(text) {
  const lines=[], row=[]; let cell='', quoted=false;
  for(let i=0;i<text.length;i++){const c=text[i],n=text[i+1];if(c==='"'){if(quoted&&n==='"'){cell+='"';i++;}else quoted=!quoted;}else if(c===','&&!quoted){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&n==='\n')i++;row.push(cell);lines.push(row.splice(0));cell='';}else cell+=c;}
  if(cell!==''||row.length){row.push(cell);lines.push(row);}
  if(lines.length<2) throw Error('ไม่พบข้อมูลในลิงก์');
  const headers=lines.shift().map(x=>String(x).trim());
  return lines.filter(r=>r.some(x=>String(x).trim())).map(r=>{const o={};headers.forEach((h,i)=>o[h]=r[i]||'');return o;});
}

// นำข้อมูลจากแท็บเดิมเข้าคลังครั้งแรก หากพบหัวตารางภาษาไทย/อังกฤษที่รู้จัก
function importExisting_() { const target=sheet_('Inventory'); if(target.getLastRow()>1)return; const skip=['Inventory','Transactions','Assets','Settings']; const source=ss_().getSheets().find(s=>skip.indexOf(s.getName())<0&&s.getLastRow()>1); if(!source)return; const v=source.getDataRange().getValues(), h=v[0].map(x=>String(x).trim().toLowerCase()); const col=(names)=>{for(const n of names){const i=h.indexOf(n.toLowerCase());if(i>=0)return i;}return -1;}; const name=col(['name','รายการ','ชื่อรายการ','ชื่อพัสดุ']), qty=col(['quantity','จำนวน','คงเหลือ','ยอดคงเหลือ']); if(name<0||qty<0)return; const code=col(['code','รหัส','รหัสพัสดุ']),cat=col(['category','หมวดหมู่','ประเภท']),unit=col(['unit','หน่วย']),price=col(['price','ราคา','ราคาต่อหน่วย']),loc=col(['location','สถานที่','จุดเก็บ']); v.slice(1).forEach(r=>{if(!r[name])return;append_('Inventory',{ItemID:id_('IT'),Code:code<0?'':r[code],Name:r[name],Category:cat<0?'ทั่วไป':r[cat],Unit:unit<0?'ชิ้น':r[unit],Quantity:num_(r[qty]),MinStock:5,Price:price<0?0:num_(r[price]),Location:loc<0?'':r[loc],Type:'พัสดุ',Status:'ใช้งาน',UpdatedAt:new Date(),Notes:''});}); }
