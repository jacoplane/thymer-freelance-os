// Fictional sample content only. Dates are relative to the day the demo is seeded.
export function demoData(today = new Date()) {
    const date = offset => { const value = new Date(today); value.setDate(value.getDate() + offset); return `${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,'0')}-${String(value.getDate()).padStart(2,'0')}`; };
    return {
        clients: [
            ['Northwind Studio','active','Studio care',390,'Monthly','Alex · hello@northwind.example'],
            ['Maple & Moss','active','Commerce care',450,'Monthly','Sam · hello@maplemoss.example'],
            ['Orbit Coffee','active','Essential care',300,'Monthly','Robin · hello@orbitcoffee.example'],
            ['Cedarworks Co.','active','Project engagement',0,'Project','Morgan · hello@cedarworks.example'],
            ['Paper Lantern Books','prospect','Discovery proposal',0,'Project','Jamie · hello@paperlantern.example'],
            ['Harbor Collective','prospect','Website proposal',0,'Project','Casey · hello@harbor.example']
        ],
        projects: [
            {title:'Website refresh',client:'Northwind Studio',status:'in_progress',priority:'high',deadline:date(7),tasks:[
                ['Send homepage prototype','important',date(0),'next','focus'],['Finish mobile navigation','none',date(-1)],['Confirm launch checklist','none',date(5)],['Approve project brief','done']
            ]},
            {title:'Online shop launch',client:'Maple & Moss',status:'in_review',priority:'high',deadline:date(3),tasks:[
                ['Review checkout feedback','none',date(0),'next','focus'],['Receive product photography','blocked','', 'waiting'],['Polish product cards','none',date(2)],['Complete storefront prototype','done']
            ]},
            {title:'Care plan · Q4',client:'Orbit Coffee',status:'in_progress',priority:'medium',deadline:date(12),tasks:[
                ['Run monthly health check','none',date(1),'next','focus'],['Share care plan report','none',date(4)],['Update CMS and extensions','done']
            ]},
            {title:'Member portal',client:'Cedarworks Co.',status:'in_progress',priority:'medium',deadline:date(10),tasks:[
                ['Outline member onboarding','none',date(3)],['Map account permissions','none',date(6)],['Confirm portal scope','done']
            ]},
            {title:'Brand workshop',client:'Paper Lantern Books',status:'backlog',priority:'low',deadline:date(20),tasks:[['Draft discovery questions','none']]},
            {title:'Landing page sprint',client:'Northwind Studio',status:'completed',priority:'medium',deadline:date(-4),tasks:[['Publish campaign landing page','done']]}
        ],
        invoices: [
            ['DEMO-001 · Website deposit','Northwind Studio',3200,'sent','paid',date(-24),date(-10)],
            ['DEMO-002 · Storefront build','Maple & Moss',4200,'sent','paid',date(-19),date(-5)],
            ['DEMO-003 · Care plan','Orbit Coffee',1200,'sent','paid',date(-12),date(-2)],
            ['DEMO-004 · Website milestone','Northwind Studio',1200,'sent','unpaid',date(-21),date(-7)],
            ['DEMO-005 · Shop launch','Maple & Moss',1800,'sent','unconfirmed',date(-7),date(4)],
            ['DEMO-006 · Portal discovery','Cedarworks Co.',900,'sent','unpaid',date(-3),date(11)],
            ['DEMO-007 · Brand workshop','Paper Lantern Books',1600,'draft','unpaid',date(0),date(21)]
        ],
        sessions: [
            ['Northwind Studio · 1.5 h · navigation review','Northwind Studio','Website refresh',date(-2),1.5,'Reviewed mobile navigation and agreed the next prototype changes.'],
            ['Maple & Moss · 0.75 h · checkout support','Maple & Moss','Online shop launch',date(0),0.75,'Checked checkout feedback and answered launch questions.'],
            ['Orbit Coffee · 1 h · monthly health check','Orbit Coffee','Care plan · Q4',date(-5),1,'Reviewed updates and completed the monthly site health check.']
        ],
        review: {notes:'Shipped the campaign landing page and signed off the storefront prototype. Keep a closer eye on external assets before promising launch dates.',priorities:'Launch the online shop. Finish the website navigation. Agree the member portal onboarding flow.'},
        waiting: {reason:'Client is selecting the final product images.',followup:date(0)},
        today:date(0)
    };
}
