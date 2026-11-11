import test from 'node:test';
import assert from 'node:assert/strict';
import {dashboardHtml,requestProgress} from '../company-dashboard.js';

const set={id:'s1',name:'مبل سه‌نفره',status:'published',description:'مدل',set_products:[{products:{name:'مبل'}}],layouts:[],colorways:[]};
const photo={id:'p1',url:'https://example.invalid/photo.webp',filename:'front.webp'};
const base={company:{name:'فروشگاه آزمایشی',profile:{}},sets:[set],company_media:[photo],company_requests:[],subscriptions:[],branches:[],showroom_accounts:[],company_notifications:[],notification_reads:[],support_tickets:[]};

test('maps actual modeling workflow to approved milestones',()=>{
 for(const [status,expected] of [['submitted',20],['reviewing',30],['in_progress',30],['completed',70],['approved',100]])assert.equal(requestProgress({status}),expected);
 assert.equal(requestProgress({status:'needs_info',set_id:'s1'}),70);
});

test('shows request photos until approved and keeps large web viewer',()=>{
 const r={id:'r1',kind:'model',title:'ست جدید',status:'completed',set_id:'s1',media_ids:['p1'],created_at:new Date().toISOString()};
 const html=dashboardHtml('sets',{...base,company_requests:[r]},'');
 assert.match(html,/front\.webp/);
 assert.match(html,/مشاهده و ویرایش در وب/);
 const approved=dashboardHtml('sets',{...base,company_requests:[{...r,status:'approved'}]},'');
 assert.doesNotMatch(approved,/<img[^>]+front\.webp/);
 assert.match(approved,/۱۰۰٪/);
});

test('groups agents and quota into one panel',()=>{
 const agent={id:'a1',display_name:'مریم محمدی',branch_id:'b1',login_name:'maryam11',status:'active'};
 const html=dashboardHtml('agents',{...base,branches:[{id:'b1',name:'شعبه ۱۱'}],showroom_accounts:[agent],limits:{max_agents:3,max_branches:5}},'');
 assert.match(html,/مریم محمدی/);
 assert.match(html,/شعبه ۱۱/);
 assert.match(html,/maryam11/);
 assert.match(html,/۱ از ۳/);
});
