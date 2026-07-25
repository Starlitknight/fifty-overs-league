  // =========================================================================
  // Squad page rebuild + name hygiene (reviewer pass).
  // The squad page becomes a decision surface: summary strip, structural
  // warnings, dense sortable rows with numbers beside the skill words, and a
  // click-to-expand detail. Training is a read-only badge here · the Training
  // page is the one canonical home for assignments.
  // =========================================================================
  try {
    var foSqCss = document.createElement("style");
    foSqCss.textContent =
      ".fo-sq-strip{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin:10px 0 4px}" +
      ".fo-sq-stat{display:flex;align-items:center;gap:12px;background:#FFFEFC;border:1px solid rgba(28,36,51,.08);border-radius:12px;padding:12px 16px;box-shadow:0 2px 10px rgba(7,22,46,.05)}" +
      ".fo-sqs-ic{flex:0 0 40px;width:40px;height:40px;border-radius:12px;display:flex;align-items:center;justify-content:center}" +
      ".fo-sqs-tx{min-width:0}" +
      ".fo-sqs-ic{background:#F3F1EA}" +
      ".fo-sqs-c1 .fo-sqs-ic{color:#0E233F}.fo-sqs-c1 span{color:#4a5e7d}" +
      ".fo-sqs-c2 .fo-sqs-ic{color:#8a5c13}.fo-sqs-c2 span{color:#8a5c13}" +
      ".fo-sqs-c3 .fo-sqs-ic{color:#15803D}.fo-sqs-c3 span{color:#2e6b46}" +
      ".fo-sq-stat span{display:block;font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:#8a93a3;font-weight:700;margin-bottom:4px}" +
      ".fo-sq-stat b{font-size:21px;color:#0E233F}" +
      ".fo-sq-stat i{font-style:normal;font-size:12px;color:#5a6472;margin-left:7px}" +
      ".fo-sq-stat .fo-pos{color:#15803D}.fo-sq-stat .fo-warm{color:#a06a1f}" +
      ".fo-sq-warn{display:flex;align-items:center;gap:12px;background:#F6E3B4;border:1px solid #e8cf8c;border-radius:10px;padding:10px 14px;margin:10px 0;font-size:13px;color:#5a4310;font-weight:600}" +
      ".fo-sq-warn .fo-sq-fix{margin-left:auto;white-space:nowrap;background:#0E233F;color:#FFFEFC;border:none;border-radius:8px;padding:7px 13px;font-size:12px;font-weight:700;cursor:pointer}" +
      "html body.ftpskin .fo-sq-warn .fo-sq-fix{background:#0E233F !important;color:#FFFEFC !important;border-color:#0E233F !important}" +
      ".fo-sq-tools{display:flex;align-items:center;gap:8px;margin:12px 0 8px;flex-wrap:wrap}" +
      ".fo-sq-pill{border:1px solid rgba(28,36,51,.18);background:#FFFEFC;color:#0E233F;border-radius:999px;padding:6px 14px;font-size:12.5px;font-weight:700;cursor:pointer}" +
      ".fo-sq-pill.on{background:#0E233F;color:#fff;border-color:#0E233F}" +
      "html body.ftpskin button.fo-sq-pill{background:#FFFEFC !important;color:#0E233F !important;border-color:rgba(28,36,51,.18) !important}" +
      "html body.ftpskin button.fo-sq-pill.on{background:#0E233F !important;color:#fff !important;border-color:#0E233F !important}" +
      ".fo-sq-sortw{margin-left:auto;font-size:12.5px;color:#5a6472}.fo-sq-sortw select{font-size:12.5px;padding:5px 8px;border-radius:8px}" +
      ".fo-sq-head{display:grid;gap:10px;align-items:center;padding:4px 14px;font-size:10.5px;letter-spacing:.07em;text-transform:uppercase;color:#8a93a3;font-weight:700}" +
      ".fo-sqr-row{display:grid;gap:10px;align-items:center;padding:9px 14px;background:#FFFEFC;border:1px solid rgba(28,36,51,.07);border-radius:10px;margin:6px 0;cursor:pointer;transition:box-shadow .12s ease}" +
      ".fo-sqr-row:hover{box-shadow:0 3px 14px rgba(7,22,46,.10)}" +
      ".fo-sqr-row,.fo-sq-head{grid-template-columns:minmax(200px,1.5fr) 58px 100px minmax(140px,1fr) minmax(140px,1fr) 46px 92px 16px}" +
      ".fo-sq-warnrow{background:#FBF0D8;border-color:#e8cf8c}" +
      ".fo-sq-nm b{font-size:14px;color:#0E233F}.fo-sq-nm a{color:#0E233F !important;text-decoration:none;font-weight:800}" +
      "#page .fo-sq-nm a{color:#0E233F !important}" +
      ".fo-sq-sub{font-size:11.5px;color:#7a8494;margin-top:1px}" +
      ".fo-sq-talent{display:inline-block;background:#EEE8FA;color:#5b4a91;border-radius:7px;padding:1px 7px;font-size:10.5px;font-weight:700;margin-left:6px;vertical-align:1px}" +
      ".fo-sq-t-warn{background:#F6E3B4;color:#7a5c13}" +
      ".fo-sq-age{font-size:13.5px;color:#0E233F;font-weight:700}.fo-sq-age i{font-style:normal;color:#8a93a3;font-weight:400;margin-left:3px}" +
      ".fo-sq-age .up{color:#15803D}.fo-sq-age .dn{color:#b3402a}" +
      ".fo-fb{display:inline-block;border-radius:999px;padding:3px 11px;font-size:11.5px;font-weight:700}" +
      ".fo-fb-lo{background:#F3D8D3;color:#8a2f1d}.fo-fb-sh{background:#F6E3B4;color:#7a5c13}.fo-fb-md{background:#E8EAEE;color:#5a6472}.fo-fb-hi{background:#D8EADF;color:#1c5537}" +
      ".fo-sq-skbar{height:7px;border-radius:4px;background:#E8EAEE;overflow:hidden;margin-bottom:3px}.fo-sq-skbar i{display:block;height:100%;border-radius:4px}" +
      ".fo-sq-sknum{font-size:11.5px;color:#5a6472}.fo-sq-sknum b{font-size:12px;color:#0E233F}" +
      ".fo-sq-nil .fo-sq-skbar i{background:#c9ced8}.fo-sq-nil .fo-sq-sknum{color:#a7aeba}" +
      ".fo-sq-ovr{font-size:17px;font-weight:800;color:#0E233F;text-align:right}" +
      ".fo-sq-wage{text-align:right;font-size:13px;font-weight:700;color:#0E233F}.fo-sq-wage i{display:block;font-style:normal;font-size:10.5px;color:#8a93a3;font-weight:400}" +
      ".fo-sq-caret{color:#8a93a3;font-size:11px;text-align:right}" +
      ".fo-sq-detail{background:#FBFAF7;border:1px solid rgba(28,36,51,.08);border-top:none;border-radius:0 0 10px 10px;margin:-7px 0 6px;padding:14px 16px}" +
      ".fo-sq-dcols{display:grid;grid-template-columns:repeat(3,1fr);gap:8px 26px}" +
      ".fo-sq-dh{font-size:10.5px;letter-spacing:.07em;text-transform:uppercase;color:#8a93a3;font-weight:800;margin:4px 0 5px}" +
      ".fo-sq-dline{display:flex;align-items:center;gap:8px;font-size:12px;color:#3a4353;margin:3px 0}" +
      ".fo-sq-dline>span:first-child{flex:0 0 92px;color:#5a6472}" +
      ".fo-sq-dbar{flex:1;height:6px;border-radius:3px;background:#E8EAEE;overflow:hidden}.fo-sq-dbar i{display:block;height:100%;border-radius:3px}" +
      ".fo-sq-dline b{flex:0 0 22px;text-align:right;color:#0E233F}.fo-sq-dline em{flex:0 0 92px;font-style:normal;color:#7a8494;font-size:11.5px}" +
      ".fo-sq-dfoot{display:flex;flex-wrap:wrap;gap:8px 18px;align-items:center;margin-top:10px;padding-top:10px;border-top:1px dashed rgba(28,36,51,.12);font-size:12px;color:#5a6472}" +
      ".fo-sq-dfoot b{color:#0E233F}" +
      ".fo-sq-train{background:#E4EEF6;color:#1f4e6b;border-radius:8px;padding:3px 10px;font-weight:700}" +
      ".fo-sq-foot{font-size:11.5px;color:#8a93a3;margin:8px 2px}" +
      ".fo-sq-tired{display:inline-block;background:#F3D8D3;color:#8a2f1d;border-radius:7px;padding:1px 7px;font-size:10px;font-weight:800;margin-left:6px;vertical-align:1px}" +
      ".fo-sq-enb-m{display:inline-block;width:62px;margin-left:8px;vertical-align:2px}" +
    ".fo-sq-enb{display:block;width:54px;height:4px;border-radius:2px;background:#E8EAEE;overflow:hidden;margin-top:5px}" +
      ".fo-sq-enb i{display:block;height:100%;border-radius:2px}" +
      ".fo-sq-mfx{display:none}" +
      ".fo-sq-mfx b{font-size:inherit;font-weight:800}" +
      ".fo-mfx-lo{color:#b3402a}.fo-mfx-sh{color:#b07f13}.fo-mfx-md{color:#5a6472}.fo-mfx-hi{color:#15803D}" +
      "@media(max-width:820px){" +
      ".fo-sq-strip{grid-template-columns:1fr;gap:8px;margin:8px 0 4px}" +
      ".fo-sq-stat{display:flex;align-items:center;gap:10px;padding:8px 12px}" +
      ".fo-sqs-ic{flex:0 0 30px;width:30px;height:30px;border-radius:9px}.fo-sqs-ic svg{width:16px;height:16px}" +
      ".fo-sqs-tx{display:flex;align-items:baseline;gap:10px;flex:1;min-width:0}" +
      ".fo-sq-stat span{margin:0;flex:0 0 auto}.fo-sq-stat b{font-size:16px}.fo-sq-stat i{margin-left:auto;text-align:right;font-size:11px}" +
      ".fo-sq-warn{padding:8px 11px;font-size:12px;gap:8px}.fo-sq-warn .fo-sq-fix{padding:6px 10px;font-size:11px}" +
      ".fo-sqr-row,.fo-sq-head{grid-template-columns:minmax(92px,1.4fr) 30px minmax(58px,1fr) minmax(58px,1fr) 30px;gap:6px;padding:8px 10px}" +
      ".fo-sq-form,.fo-sq-wage,.fo-sq-hwage,.fo-sq-caret,.fo-sq-talent,.fo-sq-nickchip,.fo-sq-tired{display:none}" +
      ".fo-sq-nm b,.fo-sq-nm a{font-size:12.5px}.fo-sq-sub{font-size:10px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
      ".fo-sq-age{font-size:12px}.fo-sq-ovr{font-size:14px}" +
      ".fo-sq-skw{display:none}.fo-sq-sknum{font-size:10.5px}" +
      ".fo-sq-mfx{grid-column:1/-1;display:flex;gap:16px;margin-top:2px;padding-top:5px;border-top:1px dashed rgba(28,36,51,.10);font-size:9.5px;letter-spacing:.05em;text-transform:uppercase;font-weight:800}" +
      ".fo-sq-mfx i{font-style:normal;color:#a7aeba}" +
      ".fo-sq-dcols{grid-template-columns:1fr}}";
    document.head.appendChild(foSqCss);
  } catch (e) {}

  // ---- name hygiene: the Dutch pool was 15 first names x 16 surnames, so a
  // twelve-man squad statistically fills with Nielses and Kuipers. Widen the
  // pools for every future player, steer generation toward least-used names,
  // and deterministically rename the 3rd+ holder of a first/last name in each
  // existing squad (history and orders migrate with the rename).
  try {
    if (typeof NATNAMES !== "undefined" && !NATNAMES.__foWide) {
      NATNAMES.__foWide = 1;
      // Every nation gets a deep bench of first and last names, so squads and
      // scouting pools stop repeating the same dozen combinations.
      var FO_NAME_EXTRAS = {
        "Netherlands": {
          fn: ["Willem", "Hugo", "Jelle", "Tobias", "Floris", "Gijs", "Maarten", "Bas", "Rens", "Stefan", "Dirk", "Koen", "Teun", "Vincent", "Olivier", "Boris", "Twan", "Guus", "Ivo", "Mees", "Pepijn", "Roel", "Sander", "Tijmen", "Luuk", "Douwe", "Hidde", "Jort", "Melle", "Siem"],
          ln: ["Mulder", "de Groot", "Bos", "Vermeer", "Hoekstra", "Prins", "Blom", "Kok", "van Leeuwen", "Schouten", "Dekker", "Timmermans", "Groen", "Sanders", "Post", "van den Berg", "Roos", "Zwart", "Koning", "van Dam", "Meijer", "Aalbers", "Slot", "Terpstra", "Scholten", "Huisman", "Bosman", "van Vliet", "Driessen", "Peeters"]
        },
        "Australia": {
          fn: ["Ethan", "Riley", "Hunter", "Flynn", "Angus", "Darcy", "Toby", "Heath", "Joel", "Aaron", "Blake", "Curtis", "Dylan", "Fraser", "Jai", "Marcus", "Patrick", "Reece", "Shaun", "Travis", "Tyler", "Xavier", "Zane", "Brody", "Clint", "Damon", "Rhys", "Spencer"],
          ln: ["Sutherland", "Gilmore", "Hastings", "Lawson", "Paterson", "Reid", "Sheppard", "Stanton", "Thompson", "Walters", "Webster", "Whiteman", "Fletcher", "Griffin", "Jennings", "Kelly", "McArthur", "Nolan", "Pearce", "Quinn", "Sanders", "Tremain", "Buckley", "Cartwright", "Connolly", "Bradley", "Abbott", "Bennett"]
        },
        "India": {
          fn: ["Aditya", "Akash", "Ankit", "Deepak", "Gaurav", "Harsh", "Jayant", "Kunal", "Manish", "Mayank", "Mohit", "Naveen", "Piyush", "Rahul", "Rajat", "Sameer", "Shreyas", "Suresh", "Tarun", "Uday", "Varun", "Vinay", "Yash", "Abhishek", "Devansh", "Kartik", "Nishant", "Parth"],
          ln: ["Agarwal", "Bhatt", "Chauhan", "Deshmukh", "Dixit", "Gaikwad", "Joshi", "Kulkarni", "Malhotra", "Menon", "Mishra", "Nair", "Pandey", "Pillai", "Rao", "Rathore", "Saxena", "Shukla", "Sinha", "Solanki", "Srinivasan", "Tiwari", "Tripathi", "Varma", "Venkatesan", "Yadav", "Chandra", "Goswami"]
        },
        "Pakistan": {
          fn: ["Adnan", "Asif", "Bilal", "Danish", "Fahad", "Farhan", "Hamza", "Haris", "Hassan", "Junaid", "Kashif", "Nadeem", "Omar", "Saad", "Salman", "Shan", "Sohail", "Taimur", "Usman", "Waqar", "Zafar", "Zain", "Arsalan", "Ehsan", "Imad", "Mohsin", "Rehan", "Shoaib"],
          ln: ["Abbasi", "Ansari", "Baig", "Butt", "Chaudhry", "Dar", "Farooq", "Gul", "Hameed", "Haq", "Javed", "Khalil", "Latif", "Mahmood", "Mirza", "Mushtaq", "Nawaz", "Qadir", "Qureshi", "Riaz", "Saeed", "Sarwar", "Shah", "Sheikh", "Siddiqui", "Tariq", "Younis", "Zaman"]
        },
        "Sri Lanka": {
          fn: ["Akila", "Angelo", "Asela", "Bhanuka", "Chamara", "Chandima", "Dasun", "Dhananjaya", "Dilruwan", "Dimuth", "Dinuka", "Dushmantha", "Isuru", "Janith", "Kamindu", "Kavindu", "Lahiru", "Maheesh", "Minod", "Niroshan", "Oshada", "Pramod", "Ramesh", "Sahan", "Suranga", "Thisara", "Vishwa", "Ashen"],
          ln: ["Atapattu", "Ekanayake", "Gunathilaka", "Gunawardene", "Jayasuriya", "Jayawardena", "Kulasekara", "Lakmal", "Liyanage", "Madushanka", "Munaweera", "Pathirana", "Peiris", "Premadasa", "Pushpakumara", "Samarawickrama", "Senanayake", "Seneviratne", "Thirimanne", "Udana", "Vandersay", "Weerasinghe", "Wickramasinghe", "Wijesundera", "Zoysa", "Ranatunga", "Dickwella", "Amarasinghe"]
        },
        "New Zealand": {
          fn: ["Adam", "Ben", "Brad", "Cameron", "Corey", "Dane", "Dion", "Ethan", "Gareth", "Henry", "Isaac", "Jacob", "James", "Josh", "Kieran", "Lewis", "Mark", "Matt", "Ollie", "Rhys", "Ross", "Sam", "Sean", "Todd", "Tom", "Zak", "Bevan", "Angus"],
          ln: ["Anderson", "Bracewell", "Broom", "Burns", "Cleaver", "Devine", "Ferguson", "Gillespie", "Greenwood", "Hart", "Horne", "Jamieson", "Kitchen", "Lister", "Marshall", "Mason", "McClure", "Nichol", "Parker", "Priest", "Rutherford", "Sinclair", "Somerville", "Watson", "Weston", "Young", "Hopkins", "Bell"]
        },
        "South Africa": {
          fn: ["Andile", "Beuran", "Corbin", "Daryn", "Dean", "Donovan", "Duanne", "Gerald", "Grant", "Hardus", "Janneman", "Jason", "Keegan", "Kyle", "Lizaad", "Lutho", "Migael", "Nandre", "Okuhle", "Pieter", "Raynard", "Rudi", "Senuran", "Sibonelo", "Thando", "Wayne", "Zubayr", "Divan"],
          ln: ["Ackermann", "Bosch", "Breetzke", "Bruyns", "Conradie", "Cloete", "du Preez", "Erasmus", "Ferreira", "Hendricks", "Jacobs", "Jonker", "Kruger", "le Roux", "Linde", "Magala", "Meyer", "Nel", "Olivier", "Oosthuizen", "Potgieter", "Rossouw", "Smith", "Swanepoel", "van der Merwe", "Viljoen", "Zwane", "Mthethwa"]
        },
        "England": {
          fn: ["Alfie", "Archie", "Charlie", "Daniel", "Dominic", "Eddie", "Ellis", "Finlay", "Freddie", "George", "Henry", "Isaac", "Jacob", "Jamie", "Joe", "Josh", "Lewis", "Louis", "Luke", "Mason", "Max", "Oscar", "Reuben", "Rory", "Sebastian", "Theo", "Toby", "Tommy"],
          ln: ["Ainsworth", "Barker", "Bickley", "Chadwick", "Cole", "Crawford", "Dunn", "Ellison", "Fairbairn", "Gibbs", "Hale", "Hargreaves", "Hollins", "Ingram", "Jarvis", "Kirby", "Lowe", "Mercer", "Norris", "Ogden", "Pickering", "Radcliffe", "Sharpe", "Thorne", "Vickers", "Whitehead", "Yardley", "Stanton"]
        },
        "West Indies": {
          fn: ["Akeal", "Brandon", "Chadwick", "Dominic", "Darnell", "Delano", "Jamal", "Javon", "Jerome", "Johann", "Justin", "Kavem", "Keon", "Kester", "Kevin", "Kimani", "Leon", "Malik", "Nyeem", "Obed", "Raheem", "Rashawn", "Ricardo", "Shamar", "Sherwin", "Teddy", "Tevin", "Trevon"],
          ln: ["Archibald", "Baptiste", "Benjamin", "Bonner", "Cummings", "Dowrich", "Edwards", "Francis", "Gordon", "Grant", "Harding", "Hinds", "Jacobs", "James", "King", "Lambert", "McKenzie", "Nurse", "Paul", "Phillip", "Reifer", "Richardson", "Roberts", "Springer", "Williams", "Weekes", "Prescod", "Small"]
        },
        "Afghanistan": {
          fn: ["Abdullah", "Amanullah", "Asadullah", "Aziz", "Baryalai", "Darwish", "Farid", "Habib", "Hamid", "Ihsanullah", "Ikram", "Jamshid", "Javed", "Khalil", "Massoud", "Mirwais", "Naqib", "Nasir", "Qais", "Rahim", "Rahmanullah", "Samiullah", "Sayed", "Shafiq", "Sharif", "Waheed", "Wali", "Zubair"],
          ln: ["Afghan", "Ahmadzai", "Alikhil", "Ashraf", "Atal", "Barakzai", "Daudzai", "Durrani", "Ghafari", "Ghani", "Hotak", "Ishaqzai", "Kakar", "Karimi", "Khoshi", "Kohistani", "Malikzai", "Mangal", "Naseri", "Painda", "Popalzai", "Qaderi", "Rasooli", "Sadiqi", "Shinwari", "Wardak", "Yousafzai", "Zazai"]
        },
        "Ireland": {
          fn: ["Aidan", "Barry", "Brendan", "Cathal", "Ciaran", "Colm", "Darragh", "Eamon", "Fergal", "Fionn", "Gavin", "Kevin", "Killian", "Lorcan", "Niall", "Oisin", "Oran", "Padraig", "Peadar", "Pearse", "Ruairi", "Seamus", "Shane", "Tadhg", "Turlough", "Diarmuid", "Enda", "Malachy"],
          ln: ["Aherne", "Boyle", "Brady", "Callaghan", "Casey", "Cullen", "Daly", "Delaney", "Doherty", "Donnelly", "Duffy", "Fitzgerald", "Flanagan", "Gormley", "Hayes", "Healy", "Keane", "Maguire", "McGrath", "McKenna", "Moran", "Nolan", "O'Donnell", "O'Rourke", "Quigley", "Whelan", "Hughes", "Corcoran"]
        },
        "Zimbabwe": {
          fn: ["Admire", "Anesu", "Batsirai", "Bright", "Clive", "Dion", "Donald", "Elton", "Farai", "Gerald", "Innocent", "Kudakwashe", "Kundai", "Luke", "Malcolm", "Milton", "Nkosana", "Nyasha", "Panashe", "Prince", "Prosper", "Ronald", "Simba", "Tanaka", "Tarisai", "Tawanda", "Trevor", "Wellington"],
          ln: ["Bhebhe", "Chari", "Chidzambwa", "Chikwava", "Dhliwayo", "Gwenzi", "Hlatywayo", "Kamungozi", "Madziva", "Mahachi", "Makoni", "Maphosa", "Matibiri", "Mpariwa", "Mubaiwa", "Mucheke", "Munyonga", "Musoko", "Mutizwa", "Ndlovu", "Nkomo", "Rusike", "Shumba", "Zondo", "Zvirekwi", "Chirwa", "Gumede", "Sithole"]
        }
      };
      Object.keys(FO_NAME_EXTRAS).forEach(function (k) {
        var P = NATNAMES[k]; if (!P) return;
        FO_NAME_EXTRAS[k].fn.forEach(function (n) { if (P.fn.indexOf(n) < 0) P.fn.push(n); });
        FO_NAME_EXTRAS[k].ln.forEach(function (n) { if (P.ln.indexOf(n) < 0) P.ln.push(n); });
      });
    }
  } catch (e) {}
  // the frontier nations draw from their own name banks
  try {
    var FO_NEW_NATS = {
      Bangladesh: { fn: ["Tamim", "Mushfiq", "Mehidy", "Litton", "Shoriful", "Nurul", "Afif", "Taskin", "Anamul", "Sabbir", "Rubel", "Mahedi"], ln: ["Chowdhury", "Hossain", "Rahman", "Islam", "Ahmed", "Sarkar", "Miah", "Uddin", "Karim", "Bhuiyan", "Talukder", "Sheikh"] },
      Nepal: { fn: ["Sandeep", "Kushal", "Rohit", "Dipendra", "Karan", "Sompal", "Gulsan", "Binod", "Sagar", "Lalit", "Pawan", "Aarif"], ln: ["Rana", "Thapa", "Gurung", "Shrestha", "Karki", "Bhandari", "Magar", "Khadka", "Lamichhane", "Paudel", "Airee", "Bhurtel"] },
      Scotland: { fn: ["Angus", "Calum", "Ewan", "Fraser", "Hamish", "Lachlan", "Murray", "Rory", "Duncan", "Finlay", "Gregor", "Struan"], ln: ["MacLeod", "Campbell", "Stewart", "MacDonald", "Munro", "Sinclair", "Douglas", "Cameron", "Buchanan", "Lamont", "Kerr", "Wallace"] },
      Wales: { fn: ["Gareth", "Rhys", "Owain", "Dylan", "Ieuan", "Carwyn", "Aled", "Emyr", "Morgan", "Sion", "Tomos", "Bryn"], ln: ["Llewellyn", "Morgan", "Davies", "Evans", "Griffiths", "Hughes", "Jenkins", "Owens", "Price", "Thomas", "Vaughan", "Probert"] },
      Kenya: { fn: ["David", "Collins", "Nelson", "Shem", "Dhiren", "Rakep", "Irfan", "Lucas", "Gerald", "Emmanuel", "Brian", "Peter"], ln: ["Otieno", "Odhiambo", "Ouma", "Obuya", "Ngoche", "Karim", "Patel", "Musyoka", "Wanjala", "Omondi", "Mwangi", "Njoroge"] },
      "United States": { fn: ["Tyler", "Corey", "Aaron", "Monank", "Jaskaran", "Saurabh", "Andries", "Steven", "Cameron", "Milind", "Hayden", "Jessy"], ln: ["Brooks", "Anderson", "Walker", "Patel", "Sharma", "Taylor", "Johnson", "Mitchell", "Hayes", "Kumar", "Reyes", "Van Buren"] },
      Canada: { fn: ["Marcus", "Navneet", "Harsh", "Nicholas", "Aaron", "Dilpreet", "Kaleem", "Ravinder", "Shreyas", "Liam", "Jatinder", "Cody"], ln: ["Dhillon", "Singh", "Gill", "Kirton", "Johnson", "Bajwa", "Sandhu", "Persaud", "Whyte", "Tremblay", "Mackenzie", "Sidhu"] }
    };
    if (typeof NATNAMES !== "undefined") Object.keys(FO_NEW_NATS).forEach(function (k) { if (!NATNAMES[k]) NATNAMES[k] = FO_NEW_NATS[k]; });
  } catch (eNn) {}
  function foNameParts(nm) { var i = (nm || "").indexOf(" "); return i < 0 ? [nm || "", ""] : [nm.slice(0, i), nm.slice(i + 1)]; }
  function foHash32(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }
  try {
    if (typeof window.natName === "function" && !window.natName.__fo) {
      var _natName = window.natName;
      window.natName = function (nat, rnd, used) {
        try {
          var pool = NATNAMES[nat] || NATNAMES["England"];
          var fnc = {}, lnc = {};
          if (typeof GD !== "undefined" && GD.teams) GD.teams.forEach(function (t) {
            (t.players || []).concat(t.youth || []).forEach(function (p) {
              var sp = foNameParts(p.name); fnc[sp[0]] = (fnc[sp[0]] || 0) + 1; lnc[sp[1]] = (lnc[sp[1]] || 0) + 1;
            });
          });
          var best = null, bestSc = 1e9;
          for (var i = 0; i < 14; i++) {
            var f = pool.fn[Math.floor(rnd() * pool.fn.length)], l = pool.ln[Math.floor(rnd() * pool.ln.length)], nm = f + " " + l;
            if (used ? used.has(nm) : (typeof findPlayer === "function" && findPlayer(nm))) continue;
            var sc = (fnc[f] || 0) * 2 + (lnc[l] || 0);
            if (sc === 0) return nm;
            if (sc < bestSc) { bestSc = sc; best = nm; }
          }
          return best || _natName(nat, rnd, used);
        } catch (e2) { return _natName(nat, rnd, used); }
      };
      window.natName.__fo = 1;
    }
  } catch (e) {}
  function foPickName(list, counts, seed, ok) {
    var off = seed % list.length;
    for (var i = 0; i < list.length; i++) {
      var cand = list[(off + i) % list.length];
      if ((counts[cand] || 0) === 0 && (!ok || ok(cand))) return cand;
    }
    return list[off];
  }
  function foMigrateOrderNames(o, map) {
    if (!o) return;
    try {
      if (Array.isArray(o.batOrder)) o.batOrder = o.batOrder.map(function (n) { return map[n] || n; });
      if (o.captain && map[o.captain]) o.captain = map[o.captain];
      if (o.keeper && map[o.keeper]) o.keeper = map[o.keeper];
      if (o.spells) ["north", "south"].forEach(function (e) { (o.spells[e] || []).forEach(function (sp) { if (sp && map[sp.bowler]) sp.bowler = map[sp.bowler]; }); });
    } catch (e) {}
  }
  // Deterministic given the same snapshot, so every client and the resolver
  // reach identical rosters independently. Runs once per team (t.__nmfx).
  function foUniqueNames() {
    var renames = {};
    try {
      if (typeof GD === "undefined" || !GD.teams) return renames;
      var pool = (typeof NATNAMES !== "undefined") && (NATNAMES["Netherlands"] || NATNAMES["England"]);
      if (!pool) return renames;
      var world = {};
      GD.teams.forEach(function (t) { (t.players || []).concat(t.youth || []).forEach(function (p) { world[p.name] = (world[p.name] || 0) + 1; }); });
      GD.teams.forEach(function (t) {
        if (t.__nmfx >= 1) return;
        t.__nmfx = 1;
        var fnc = {}, lnc = {};
        (t.players || []).concat(t.youth || []).forEach(function (p) {
          var sp = foNameParts(p.name), newF = sp[0], newL = sp[1];
          if ((fnc[newF] || 0) >= 2) newF = foPickName(pool.fn, fnc, foHash32(t.name + "|" + p.name + "|f"), function (c) { return !world[c + " " + newL]; });
          if ((lnc[newL] || 0) >= 2) newL = foPickName(pool.ln, lnc, foHash32(t.name + "|" + p.name + "|l"), function (c) { return !world[newF + " " + c]; });
          fnc[newF] = (fnc[newF] || 0) + 1; lnc[newL] = (lnc[newL] || 0) + 1;
          var nm = newF + " " + newL;
          if (nm !== p.name) {
            world[p.name]--; world[nm] = (world[nm] || 0) + 1;
            renames[p.name] = nm;
            try { if (App.playerHist && App.playerHist[p.name] && !App.playerHist[nm]) { App.playerHist[nm] = App.playerHist[p.name]; delete App.playerHist[p.name]; } } catch (e) {}
            p.name = nm;
          }
        });
      });
      if (Object.keys(renames).length) {
        foMigrateOrderNames(App.orders, renames);
        foMigrateOrderNames(App.defaults, renames);
        try {
          if (typeof SYNC !== "undefined" && SYNC && SYNC.plannedOrders) {
            Object.keys(SYNC.plannedOrders).forEach(function (r) { foMigrateOrderNames(SYNC.plannedOrders[r], renames); });
            if (typeof foSavePlanned === "function") foSavePlanned();
          }
        } catch (e) {}
        // the map rides in the save so late order packets from stale clients
        // can still be translated by the resolver
        try { App.__foRenames = Object.assign(App.__foRenames || {}, renames); } catch (e) {}
      }
      try { window.__FO_RENAMES = Object.assign({}, (App && App.__foRenames) || {}, renames); } catch (e) {}
    } catch (e) {}
    return renames;
  }
  window.foUniqueNames = foUniqueNames;

  // ---- the squad page itself ----
  var FO_BATROLES = { opener: 1, topOrderBat: 1, middleOrderBat: 1 };
  var FO_BOWLROLES = { seamFast: 1, seamFastMedium: 1, seamMedium: 1, wristSpin: 1, fingerSpin: 1 };
  function foSqClass(p) {
    if (p.role === "wicketkeeper" || p.keeper) return "wk";
    if (p.role === "allRounder") return "ar";
    if (FO_BOWLROLES[p.role]) return "bowl";
    return "bat";
  }
  function foSqSkillCell(v, muted, label) {
    v = Math.round(v);
    var col = v >= 75 ? "#16A34A" : v >= 50 ? "#4DA6A2" : v >= 30 ? "#F59E0B" : "#DC2626";
    if (muted || v < 12) {
      return "<div class='fo-sq-skill fo-sq-nil'><div class='fo-sq-skbar'><i style='width:" + Math.max(2, Math.min(100, v)) + "%'></i></div><div class='fo-sq-sknum'>" + v + " · –</div></div>";
    }
    return "<div class='fo-sq-skill' title='" + label + ": " + word(v) + " · rank " + (wIx(v) + 1) + " of 16'><div class='fo-sq-skbar'><i style='width:" + Math.min(100, v) + "%;background:" + col + "'></i></div><div class='fo-sq-sknum'><b>" + v + "</b><span class='fo-sq-skw'> · " + word(v) + "</span></div></div>";
  }
  function foSqDetail(p, isYouth) {
    var dbar = function (v, lbl) {
      v = Math.round(v);
      var col = v >= 75 ? "#16A34A" : v >= 50 ? "#4DA6A2" : v >= 30 ? "#F59E0B" : "#DC2626";
      return "<div class='fo-sq-dline' title='" + E(word(v) || "") + "'><span>" + lbl + "</span><span class='fo-sq-dbar'><i style='width:" + Math.max(2, Math.min(100, v)) + "%;background:" + col + "'></i></span><b>" + v + "</b></div>";
    };
    var sk = S(p);
    var c1 = "<div><div class='fo-sq-dh'>Batting</div>" + dbar(aggBat(p), "Overall") + dbar(sk.vsPace || 0, "vs pace") + dbar(sk.vsSpin || 0, "vs spin") + dbar(sk.rotation || 0, "Rotation") + dbar(sk.power || 0, "Power") + dbar(sk.temperament || 0, "Temperament") + "</div>";
    var c2 = p.bowlType
      ? "<div><div class='fo-sq-dh'>Bowling</div>" + dbar(aggBowl(p), "Overall") + dbar(sk.wicket || 0, "Wicket threat") + dbar(sk.economy || 0, "Economy") + dbar(sk.discipline || 0, "Discipline") + dbar(sk.moveTurn || 0, "Move / turn") + dbar(sk.stamina || 0, "Stamina") + "</div>"
      : "<div><div class='fo-sq-dh'>Reserves</div>" + dbar(aggTech(p), "Technique") + dbar(sk.stamina || 0, "Stamina") + "</div>";
    var glove = (p.keeper || aggKeep(p) >= 20) ? dbar(sk.keeping || 0, "Keeping") + dbar(sk.stumping || 0, "Stumping") : "";
    var c3 = "<div><div class='fo-sq-dh'>In the field</div>" + dbar(sk.fielding || 0, "Fielding") + dbar(sk.catching || 0, "Catching") + glove + "</div>";
    var tals = (p.talents || []).map(function (t2) { return "<span class='fo-sq-talent' title='" + E(TALTIPS[t2] || "") + "'>" + E(ptal(t2)) + "</span>"; }).join(" ");
    var season = "";
    try { if (typeof foSeasonLine === "function") { var sl = foSeasonLine(p.name); if (sl) season = "<span class='fo-sq-season'>This season: " + sl + "</span>"; } } catch (eSl) {}
    var foot = "<div class='fo-sq-dfoot'>" + season +
      "<span>Experience <b>" + E(p.expWord || p.exp || "-") + "</b></span>" +
      "<span>Captaincy <b>" + word(p.capt || 30) + "</b></span>" +
      "<span>Energy <b>" + E((typeof foEnergyOf === "function" ? foEnergyOf(p).word : p.fatigue) || "-") + "</b></span>" +
      "<span>Nationality <b>" + E(p.nat || "-") + "</b></span>" +
      (tals ? "<span>" + tals + "</span>" : "") +
      "<span class='fo-sq-train'>Training: " + E(p.trainFocus || "none") + "</span>" +
      (isYouth ? "<button class='fo-sq-promote mini' data-n='" + E(p.name) + "'>Promote to seniors</button>" : "") +
      "</div>";
    return "<div class='fo-sq-detail'><div class='fo-sq-dcols'>" + c1 + c2 + c3 + "</div>" + foot + "</div>";
  }
  // === Squad — the XI stood on the park, and whoever you tapped in the dossier ===
  // Batting style is not stored, so it is read off the skills the way a coach
  // would describe the player: the talent he is known for first, then the
  // shape of his numbers.
  var FO_SQ_STYLETAL = { anchor: "Anchor", finisher: "Finisher", sixMachine: "Six Machine", fastStarter: "Fast Starter", busyRunner: "Busy Runner" };
  function foSqBatStyle(p) {
    var tal = (p.talents || []);
    for (var i = 0; i < tal.length; i++) if (FO_SQ_STYLETAL[tal[i]]) return FO_SQ_STYLETAL[tal[i]];
    var s = S(p), pw = s.power || 0, ro = s.rotation || 0, te = s.temperament || 0;
    if (!FO_BATROLES[p.role] && p.role !== "allRounder" && p.role !== "wicketkeeper") return "Lower order";
    if (pw >= ro + 8) return "Aggressor";
    if (te >= 68 && te >= pw) return "Anchor";
    if (ro >= pw + 8) return "Accumulator";
    return "Balanced";
  }
  function foSqBowlStyle(p) {
    if (!p.bowlType) return "Does not bowl";
    return (p.btLabel && !/does not bowl/i.test(p.btLabel)) ? p.btLabel : "Bowler";
  }
  // the five headline numbers, each one already computed by the engine
  function foSqAttrs(p) {
    var s = S(p);
    return [
      ["Batting", Math.round(aggBat(p))],
      ["Bowling", p.bowlType ? Math.round(aggBowl(p)) : 0],
      ["Fielding", Math.round(aggField(p))],
      ["Fitness", foEnergyOf(p).pct],
      ["Mental", Math.round(((s.temperament || 0) * 0.7) + ((p.capt || 30) * 0.3))]
    ];
  }
  // his last five innings, straight out of the match history
  function foSqRecent(name) {
    var h = [];
    try { h = (typeof App !== "undefined" && App.playerHist && App.playerHist[name]) || []; } catch (eH) {}
    var out = [];
    for (var i = h.length - 1; i >= 0 && out.length < 5; i--) {
      var e = h[i];
      if ((e.bb || 0) > 0 || e.o) out.push({ r: e.rr || 0, no: !e.o });
    }
    return out.reverse();
  }
  // One ramp for every rating on the page, so 57 looks the same wherever it is
  // printed. Red through amber to gold to green, over the range the generator
  // actually produces.
  var FO_SQ_RAMP = [[40, [180, 64, 47]], [55, [201, 118, 47]], [65, [201, 162, 75]], [75, [235, 194, 113]], [85, [123, 211, 166]]];
  function foSqQCol(v) {
    v = +v || 0;
    if (v <= FO_SQ_RAMP[0][0]) return "rgb(" + FO_SQ_RAMP[0][1].join(",") + ")";
    var last = FO_SQ_RAMP[FO_SQ_RAMP.length - 1];
    if (v >= last[0]) return "rgb(" + last[1].join(",") + ")";
    for (var i = 0; i < FO_SQ_RAMP.length - 1; i++) {
      var a = FO_SQ_RAMP[i], b = FO_SQ_RAMP[i + 1];
      if (v >= a[0] && v <= b[0]) {
        var t = (v - a[0]) / (b[0] - a[0]);
        return "rgb(" + a[1].map(function (c, j) { return Math.round(c + (b[1][j] - c) * t); }).join(",") + ")";
      }
    }
    return "rgb(201,162,75)";
  }
  // the list view: every player, every column sortable, each row a door to his page
  var FO_SQ_COLS = [
    { k: "pos", l: "#", s: "#", v: function (p, x) { return x.xiIx(p) < 0 ? 99 : x.xiIx(p); }, num: 1 },
    { k: "name", l: "Player", s: "Player", v: function (p) { return p.name; } },
    { k: "role", l: "Role", s: "Role", v: function (p) { return foSqClass(p); } },
    { k: "age", l: "Age", s: "Age", v: function (p) { return p.age | 0; }, num: 1 },
    { k: "ovr", l: "OVR", s: "OVR", v: function (p) { return foPkOvr(p); }, num: 1 },
    { k: "bat", l: "Batting", s: "Bat", v: function (p) { return Math.round(aggBat(p)); }, num: 1 },
    { k: "bowl", l: "Bowling", s: "Bowl", v: function (p) { return p.bowlType ? Math.round(aggBowl(p)) : -1; }, num: 1 },
    { k: "field", l: "Fielding", s: "Fld", v: function (p) { return Math.round(aggField(p)); }, num: 1 },
    { k: "fit", l: "Fit", s: "Fit", v: function (p) { return foEnergyOf(p).pct; }, num: 1 }
  ];
  function foSqTable(list, sv, capt, xiIx) {
    var ctx = { xiIx: xiIx };
    var col = null;
    FO_SQ_COLS.forEach(function (c) { if (c.k === sv.sortK) col = c; });
    if (!col) col = FO_SQ_COLS[4];
    var dir = sv.sortDir === 1 ? 1 : -1;
    var rows = list.slice().sort(function (a, b) {
      var x = col.v(a, ctx), y = col.v(b, ctx);
      if (typeof x === "string") return x.localeCompare(y) * dir;
      return (x - y) * dir;
    });
    var head = FO_SQ_COLS.map(function (c) {
      var on = c.k === sv.sortK;
      return "<th class='fo-sqt-h" + (on ? " on" : "") + (c.num ? " n" : "") + " c-" + c.k + "' data-sort='" + c.k + "'" +
        " aria-sort='" + (on ? (dir === 1 ? "ascending" : "descending") : "none") + "'>" +
        "<span class='lg'>" + E(c.l) + "</span>" +
        (c.s ? "<span class='sm'>" + E(c.s) + "</span>" : "") +
        (on ? "<i>" + (dir === 1 ? "▲" : "▼") + "</i>" : "") + "</th>";
    }).join("");
    var bar = function (v, nil) {
      if (nil) return "<span class='fo-sqt-bar nil'><u></u><b>&ndash;</b></span>";
      v = Math.max(0, Math.round(v));
      return "<span class='fo-sqt-bar'><u><i style='width:" + Math.min(100, v) + "%;background:" + foSqQCol(v) + "'></i></u><b>" + v + "</b></span>";
    };
    var body = rows.map(function (p) {
      var ix = xiIx(p), en = foEnergyOf(p), ovr = foPkOvr(p), cls = foSqClass(p);
      var lbl = cls === "wk" ? "WK" : cls === "ar" ? "AR" : cls === "bowl" ? "BOWL" : "BAT";
      return "<tr class='fo-sqt-r" + (ix >= 0 ? " inxi" : "") + "' data-n='" + E(p.name) + "' tabindex='0' role='link'" +
        " aria-label='Open the full profile for " + E(p.name) + "'>" +
        "<td class='n c-pos'>" + (ix >= 0 ? "<b>" + (ix + 1) + "</b>" : "<span class='fo-sqt-out'>&ndash;</span>") + "</td>" +
        "<td class='c-name'><span class='fo-sqt-nm'><span class='lg'>" + E(p.name) + "</span>" +
        "<span class='sm'>" + E(foSqShortName(p.name)) + "</span></span>" +
        (p.name === capt ? "<em class='fo-sqt-c'>C</em>" : "") +
        (p.__y ? "<em class='fo-sqt-y'>U20</em>" : "") +
        "<i class='fo-sqt-go' aria-hidden='true'>&#8250;</i></td>" +
        "<td class='c-role'><span class='fo-sqt-role " + cls + "'>" + lbl + "</span></td>" +
        "<td class='n c-age'>" + (p.age | 0) + "</td>" +
        "<td class='n c-ovr'><b style='color:" + foSqQCol(ovr) + "'>" + ovr + "</b></td>" +
        "<td class='c-bat'>" + bar(aggBat(p)) + "</td>" +
        "<td class='c-bowl'>" + bar(p.bowlType ? aggBowl(p) : 0, !p.bowlType) + "</td>" +
        "<td class='c-field'>" + bar(aggField(p)) + "</td>" +
        "<td class='n c-fit'><span class='" + (en.tired ? "fo-sqt-lo" : "") + "'>" + en.pct + "%</span></td>" +
        "</tr>";
    }).join("");
    return "<div class='fo-sqt-outer'>" +
      "<p class='fo-sqt-cap'>Every player at the club. Click a column to sort, a row to open his profile.</p>" +
      "<div class='fo-sqt-wrap'><table class='fo-sqt'>" +
      "<thead><tr>" + head + "</tr></thead><tbody>" + body + "</tbody></table></div></div>";
  }
  function foSqStars(ovr) {
    var n = Math.max(1, Math.min(5, Math.round(ovr / 20))), s = "";
    for (var i = 1; i <= 5; i++) s += "<span class='" + (i <= n ? "on" : "") + "'>&#9733;</span>";
    return s;
  }
  // where each man stands: the batting order laid out as a side takes the field
  var FO_SQ_ROWS = [[0, 1], [2], [3, 4, 5, 6], [7, 8, 9], [10]];

  function foSqxCss() {
    if (document.getElementById("fo-sqx-css")) return;
    var s = document.createElement("style"); s.id = "fo-sqx-css";
    s.textContent = [
      // full-bleed dark stage (widen the app's padded .wrap while mounted)
      "html body.fo-sqx-on .wrap{max-width:none !important;width:100% !important;padding:0 !important;margin:0 !important;background:transparent !important;box-shadow:none !important}",
      "html body.fo-sqx-on #topbar,html body.ftpskin.fo-sqx-on #topbar{position:fixed;top:0;left:0;right:0;z-index:60;background:linear-gradient(180deg,rgba(4,10,20,.82),rgba(4,10,20,.34) 62%,transparent) !important;border-bottom:none !important;box-shadow:none !important}",
      "html body.fo-sqx-on #page{padding-top:0 !important;margin-top:0 !important}",
      "html body.fo-sqx-on #fo-top-status{display:none}",
      "#page .fo-sqx{--gold:#EBC271;--ink:#070d18;position:relative;min-height:100vh;background:#070d18;color:#eaf0fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}",
      "#page .fo-sqx *{box-sizing:border-box}",
      "#page .fo-sqx button{font-family:Oswald,sans-serif}",
      // ---- the two-column stage: the park on the left, the man on the right ----
      ".fo-sqx-in{position:relative;z-index:1;display:grid;grid-template-columns:minmax(0,1fr) 400px;gap:18px;align-items:start;max-width:1720px;margin:0 auto;padding:64px 20px 22px}",
      // ---- the park ----
      ".fo-sqx-park{position:relative;border-radius:16px;overflow:hidden;isolation:isolate}",
      ".fo-sqx-bg{position:absolute;inset:0;background-size:cover;background-position:center 40%;z-index:0;transform:scale(1.04)}",
      ".fo-sqx-veil{position:absolute;inset:0;z-index:0;background:linear-gradient(180deg,rgba(6,11,20,.72) 0%,rgba(6,11,20,.3) 26%,rgba(6,11,20,.42) 62%,rgba(5,9,16,.84) 100%)}",
      ".fo-sqx-parkin{position:relative;z-index:1;padding:22px 20px 20px}",
      // masthead over the art
      ".fo-sqx-hd{margin-bottom:14px}",
      ".fo-sqx-hd h1{font-family:Oswald,sans-serif;font-weight:700;text-transform:uppercase;letter-spacing:.02em;font-size:clamp(34px,5vw,64px);line-height:.88;margin:0;color:#fff;text-shadow:0 4px 24px rgba(0,0,0,.6)}",
      ".fo-sqx-tag{font-family:Georgia,serif;font-style:italic;font-size:clamp(14px,1.5vw,19px);color:var(--gold);margin-top:6px;text-shadow:0 2px 12px rgba(0,0,0,.7)}",
      ".fo-sqx-next{display:inline-flex;flex-wrap:wrap;align-items:center;gap:10px;margin-top:12px;padding:8px 14px;border:1px solid rgba(235,194,113,.28);border-radius:10px;background:rgba(7,13,24,.5);backdrop-filter:blur(8px);font-family:Oswald,sans-serif;text-transform:uppercase;letter-spacing:.14em;font-size:10.5px;color:#c6d3e8}",
      ".fo-sqx-next b{color:var(--gold);letter-spacing:.18em}",
      ".fo-sqx-next span{display:inline-flex;align-items:center;gap:5px;color:#e7eefb}",
      ".fo-sqx-next i{font-style:normal;color:#6f819e}",
      // the field itself
      ".fo-sqx-field{position:relative;display:flex;flex-direction:column;gap:clamp(6px,1.4vh,16px);padding:clamp(10px,2vh,22px) 0 clamp(6px,1.4vh,14px);min-height:clamp(340px,50vh,520px);justify-content:center}",
      ".fo-sqx-row{display:flex;justify-content:center;gap:clamp(8px,1.6vw,26px);flex-wrap:nowrap}",
      // a man on the park
      "html body #page button.fo-sqx-man{position:relative;width:clamp(72px,7.2vw,104px);padding:0 0 6px !important;border:0 !important;border-radius:12px !important;font:inherit !important;cursor:pointer;background:linear-gradient(180deg,rgba(10,18,32,.42),rgba(6,11,20,.9)) !important;outline:1.5px solid rgba(150,180,225,.22);transition:transform .18s cubic-bezier(.2,.7,.2,1),outline-color .18s,box-shadow .18s}",
      "html body #page button.fo-sqx-man:hover{background:linear-gradient(180deg,rgba(14,24,42,.5),rgba(6,11,20,.94)) !important;transform:translateY(-4px);outline-color:rgba(235,194,113,.6);box-shadow:0 12px 26px rgba(0,0,0,.5)}",
      "html body #page button.fo-sqx-man.sel{outline:2px solid var(--gold);box-shadow:0 0 0 4px rgba(235,194,113,.16),0 14px 30px rgba(0,0,0,.55);transform:translateY(-4px)}",
      ".fo-sqx-man .pic{display:block;width:100%;aspect-ratio:1/1;object-fit:cover;object-position:50% 12%;border-radius:11px 11px 0 0;background:#0d1626}",
      ".fo-sqx-man .no{position:absolute;top:5px;left:5px;font-family:Oswald,sans-serif;font-weight:700;font-size:11px;line-height:1;color:#0d1526;background:rgba(235,194,113,.95);border-radius:5px;padding:2px 5px}",
      ".fo-sqx-man .cap{position:absolute;top:4px;right:4px;width:19px;height:19px;border-radius:50%;background:var(--gold);color:#0d1526;font-family:Oswald,sans-serif;font-weight:700;font-size:11px;line-height:19px;text-align:center}",
      ".fo-sqx-man .nm{display:block;font-family:Oswald,sans-serif;font-weight:600;text-transform:uppercase;letter-spacing:.02em;font-size:clamp(9px,.85vw,11.5px);line-height:1.1;color:#f2f6ff;padding:6px 4px 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      ".fo-sqx-man .rl{display:block;font-family:Oswald,sans-serif;font-weight:600;text-transform:uppercase;letter-spacing:.12em;font-size:8.5px;padding-top:2px}",
      ".fo-sqx-man .rl.bat{color:#F0BF6A}.fo-sqx-man .rl.ar{color:#5BD0A6}.fo-sqx-man .rl.bowl{color:#6FB4F5}.fo-sqx-man .rl.wk{color:#C79BF0}",
      ".fo-sqx-man .en{position:absolute;left:5px;right:5px;bottom:22px;height:3px;border-radius:2px;background:rgba(4,9,18,.7);overflow:hidden}",
      ".fo-sqx-man .en i{display:block;height:100%;background:linear-gradient(90deg,#C9A24B,var(--gold))}",
      ".fo-sqx-man .en.lo i{background:linear-gradient(90deg,#8c2f2f,#DC6A5A)}",
      ".fo-sqx-man.tgt{outline:2px dashed rgba(91,208,166,.9);animation:foSqPulse 1.3s ease-in-out infinite}",
      "@keyframes foSqPulse{0%,100%{box-shadow:0 0 0 0 rgba(91,208,166,.35)}50%{box-shadow:0 0 0 7px rgba(91,208,166,0)}}",
      "@media(prefers-reduced-motion:reduce){.fo-sqx-man.tgt{animation:none}}",
      // ---- park / list switch ----
      ".fo-sqx-views{display:inline-flex;gap:3px;margin-top:12px;padding:3px;border-radius:999px;background:rgba(7,13,24,.6);border:1px solid rgba(126,158,208,.22);backdrop-filter:blur(8px)}",
      "html body #page button.fo-sqx-vb{border:0 !important;border-radius:999px !important;padding:8px 18px !important;cursor:pointer;background:transparent !important;color:#a8b8d4 !important;font:600 10.5px Oswald,sans-serif !important;text-transform:uppercase;letter-spacing:.18em;transition:.15s}",
      "html body #page button.fo-sqx-vb:hover{color:#e7eefb !important;background:rgba(20,32,54,.7) !important}",
      "html body #page button.fo-sqx-vb.on{background:var(--gold) !important;color:#0d1526 !important}",
      // ---- the list ----
      ".fo-sqt-outer{position:relative;z-index:2;margin-top:14px;padding:13px 0 0;border-radius:14px;background:rgba(8,14,26,.86);border:1px solid rgba(126,158,208,.18);backdrop-filter:blur(6px);overflow:hidden}",
      ".fo-sqt-wrap{position:relative;overflow-x:auto;overflow-y:hidden}",
      ".fo-sqt{width:100%;min-width:660px;border-collapse:collapse}",
      ".fo-sqt-cap{margin:0 0 11px;padding:0 16px;font-family:Georgia,serif;font-style:italic;font-size:12.5px;line-height:1.5;color:#7d8fad}",
      "html body.ftpskin #page th.fo-sqt-h,html body #page th.fo-sqt-h{position:sticky;top:0;z-index:1;text-align:left;white-space:nowrap;cursor:pointer;user-select:none;padding:9px 12px;background:#0a1020 !important;color:#7d8fad !important;border-bottom:1px solid rgba(126,158,208,.24) !important;font-family:Oswald,sans-serif;font-weight:600;text-transform:uppercase;letter-spacing:.16em;font-size:9px;color:#7d8fad;transition:color .14s}",
      "html body #page th.fo-sqt-h:hover{color:var(--gold)}",
      "html body #page th.fo-sqt-h.on{color:var(--gold)}",
      "html body #page th.fo-sqt-h.n{text-align:right}",
      ".fo-sqt-h i{font-style:normal;font-size:7px;margin-left:4px;vertical-align:middle}",
      ".fo-sqt-h .sm{display:none}",
      // the skin stripes every other table row white (body.ftpskin tr:nth-child(even) td)
      // - on a dark page that reads as a fault, so this table opts out
      "html body.ftpskin #page .fo-sqt tr td,html body #page .fo-sqt tr td{background:transparent !important}",
      ".fo-sqt td{padding:9px 12px;border-bottom:1px solid rgba(126,158,208,.09);font-size:12.5px;color:#dbe4f2;vertical-align:middle}",
      ".fo-sqt td.n{text-align:right;font-variant-numeric:tabular-nums}",
      ".fo-sqt-r{cursor:pointer;transition:background .14s}",
      ".fo-sqt-r:hover,.fo-sqt-r:focus-visible{background:rgba(235,194,113,.09);outline:none}",
      ".fo-sqt-r:focus-visible td:first-child{box-shadow:inset 3px 0 0 var(--gold)}",
      ".fo-sqt-r.inxi td.c-pos b{font-family:Oswald,sans-serif;font-weight:700;font-size:13px;color:var(--gold)}",
      ".fo-sqt-out{color:#55698a}",
      ".fo-sqt-nm{font-weight:600;color:#f2f6ff}",
      ".fo-sqt-nm .sm{display:none}",
      ".fo-sqt td.c-name{max-width:1px;width:34%}",
      ".fo-sqt td.c-name .fo-sqt-nm{display:inline-block;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;vertical-align:bottom}",
      ".fo-sqt-c,.fo-sqt-y{display:inline-block;margin-left:6px;font-style:normal;font-family:Oswald,sans-serif;font-size:8.5px;letter-spacing:.1em;padding:1px 5px;border-radius:4px;vertical-align:1px}",
      ".fo-sqt-c{background:var(--gold);color:#0d1526}",
      ".fo-sqt-y{background:rgba(126,158,208,.22);color:#c6d3e8}",
      ".fo-sqt-go{float:right;font-style:normal;color:#55698a;opacity:0;transition:opacity .14s,transform .14s}",
      ".fo-sqt-r:hover .fo-sqt-go,.fo-sqt-r:focus-visible .fo-sqt-go{opacity:1;transform:translateX(3px);color:var(--gold)}",
      ".fo-sqt-role{font-family:Oswald,sans-serif;font-weight:600;text-transform:uppercase;letter-spacing:.12em;font-size:8.5px}",
      ".fo-sqt-role.bat{color:#F0BF6A}.fo-sqt-role.ar{color:#5BD0A6}.fo-sqt-role.bowl{color:#6FB4F5}.fo-sqt-role.wk{color:#C79BF0}",
      ".fo-sqt td.c-ovr b{font-family:Oswald,sans-serif;font-weight:700;font-size:14px;font-variant-numeric:tabular-nums}",
      ".fo-sqt-bar{display:flex;align-items:center;gap:8px;min-width:96px}",
      ".fo-sqt-bar u{flex:1;height:6px;border-radius:3px;background:rgba(126,158,208,.16);overflow:hidden;text-decoration:none;min-width:40px}",
      ".fo-sqt-bar u i{display:block;height:100%;border-radius:3px}",
      ".fo-sqt-bar b{font-family:Oswald,sans-serif;font-weight:600;font-size:11.5px;min-width:19px;text-align:right;font-variant-numeric:tabular-nums;color:#dbe4f2}",
      ".fo-sqt-bar.nil b{color:#55698a}",
      ".fo-sqt-lo{color:#F0A868}",
      // ---- the tool rail down the left of the park ----
      ".fo-sqx-rail{position:absolute;left:14px;top:50%;transform:translateY(-50%);z-index:3;display:flex;flex-direction:column;gap:4px;padding:8px 6px;border-radius:14px;background:rgba(7,13,24,.66);border:1px solid rgba(126,158,208,.2);backdrop-filter:blur(10px)}",
      "html body #page button.fo-sqx-rb{display:flex;flex-direction:column;align-items:center;gap:3px;width:84px;padding:9px 3px !important;border:0 !important;border-radius:10px !important;cursor:pointer;background:transparent !important;color:#98a9c6 !important;font:600 8.5px Oswald,sans-serif !important;text-transform:uppercase;letter-spacing:.08em;transition:.15s;white-space:nowrap}",
      "html body #page button.fo-sqx-rb:hover{background:rgba(20,32,54,.8) !important;color:#e7eefb !important;border-color:transparent !important}",
      "html body #page button.fo-sqx-rb.on{background:rgba(235,194,113,.14) !important;color:var(--gold) !important}",
      ".fo-sqx-rb b{font-family:Oswald,sans-serif;font-weight:700;font-size:15px;letter-spacing:0;color:#f2f6ff;line-height:1}",
      ".fo-sqx-rb .ic{font-size:15px;line-height:1}",
      // the read-out the rail switches
      ".fo-sqx-read{position:relative;z-index:2;display:flex;flex-wrap:wrap;gap:8px 18px;align-items:center;margin-top:8px;padding:10px 14px;border-radius:11px;background:rgba(7,13,24,.6);border:1px solid rgba(126,158,208,.18);font-family:Oswald,sans-serif;text-transform:uppercase;letter-spacing:.14em;font-size:10px;color:#93a5c2;backdrop-filter:blur(8px)}",
      ".fo-sqx-read b{color:#f2f6ff;letter-spacing:.08em}",
      ".fo-sqx-read em{font-style:normal;color:var(--gold)}",
      ".fo-sqx-read .warn{color:#F0A868}",
      // ---- the bench ----
      ".fo-sqx-bench{position:relative;z-index:2;margin-top:12px;padding:12px 14px;border-radius:14px;background:rgba(8,14,26,.72);border:1px solid rgba(126,158,208,.16)}",
      ".fo-sqx-bhd{display:flex;align-items:baseline;gap:10px;margin-bottom:9px}",
      ".fo-sqx-bhd b{font-family:Oswald,sans-serif;text-transform:uppercase;letter-spacing:.24em;font-size:10px;color:var(--gold)}",
      ".fo-sqx-bhd span{font-family:Oswald,sans-serif;letter-spacing:.14em;font-size:10px;color:#6f819e}",
      ".fo-sqx-brow{display:flex;gap:10px;overflow-x:auto;padding-bottom:4px;scrollbar-width:thin}",
      ".fo-sqx-brow .fo-sqx-man{flex:0 0 auto}",
      ".fo-sqx-bempty{font-family:Georgia,serif;font-style:italic;font-size:13px;color:#6f819e}",
      // ---- the dossier ----
      ".fo-sqx-dos{position:sticky;top:64px;border-radius:16px;overflow:hidden;background:linear-gradient(180deg,#0d1730,#080e1c 62%);border:1px solid rgba(126,158,208,.2);box-shadow:0 22px 60px rgba(0,0,0,.5)}",
      ".fo-sqx-dhero{position:relative;min-height:210px;padding:18px 18px 16px;overflow:hidden}",
      ".fo-sqx-dart{position:absolute;right:-6%;top:0;height:100%;width:auto;object-fit:contain;object-position:right top;opacity:.95;z-index:0;-webkit-mask-image:linear-gradient(90deg,transparent,#000 34%);mask-image:linear-gradient(90deg,transparent,#000 34%)}",
      ".fo-sqx-dhero:after{content:'';position:absolute;inset:0;z-index:1;background:linear-gradient(90deg,#0d1730 22%,rgba(13,23,48,.72) 48%,transparent 82%)}",
      ".fo-sqx-did{position:relative;z-index:2;max-width:66%}",
      ".fo-sqx-dno{font-family:Oswald,sans-serif;font-weight:700;font-size:20px;color:var(--gold);line-height:1}",
      ".fo-sqx-dnm{font-family:Oswald,sans-serif;font-weight:700;text-transform:uppercase;font-size:clamp(24px,2.2vw,32px);line-height:1;margin:3px 0 4px;color:#fff}",
      ".fo-sqx-drole{font-family:Oswald,sans-serif;font-weight:600;text-transform:uppercase;letter-spacing:.1em;font-size:12px;color:var(--gold)}",
      ".fo-sqx-dcap{display:inline-flex;align-items:center;gap:7px;margin-top:9px;padding:4px 12px 4px 4px;border-radius:999px;background:rgba(235,194,113,.14);border:1px solid rgba(235,194,113,.34);font-family:Oswald,sans-serif;text-transform:uppercase;letter-spacing:.16em;font-size:9.5px;color:var(--gold)}",
      ".fo-sqx-dcap u{width:19px;height:19px;border-radius:50%;background:var(--gold);color:#0d1526;font-weight:700;font-size:11px;line-height:19px;text-align:center;text-decoration:none}",
      ".fo-sqx-dfacts{position:relative;z-index:2;margin-top:12px;display:grid;grid-template-columns:auto 1fr;gap:6px 16px;max-width:70%}",
      ".fo-sqx-dfacts dt{font-family:Oswald,sans-serif;text-transform:uppercase;letter-spacing:.16em;font-size:9px;color:#7d8fad;align-self:center}",
      ".fo-sqx-dfacts dd{margin:0;font-family:Oswald,sans-serif;text-transform:uppercase;letter-spacing:.04em;font-size:11.5px;color:#f2f6ff;display:flex;align-items:center;gap:6px}",
      ".fo-sqx-dfacts dd img{width:19px;height:13px;object-fit:cover;border-radius:2px}",
      // tabs
      ".fo-sqx-tabs{display:flex;gap:2px;padding:0 10px;border-bottom:1px solid rgba(126,158,208,.18);background:rgba(6,11,22,.5);overflow-x:auto;scrollbar-width:none}",
      ".fo-sqx-tabs::-webkit-scrollbar{display:none}",
      "html body #page button.fo-sqx-tab{position:relative;flex:1 1 0;min-width:0;border:0 !important;border-radius:0 !important;background:transparent !important;cursor:pointer;padding:13px 2px !important;font:600 10px Oswald,sans-serif !important;text-transform:uppercase;letter-spacing:.04em;color:#7d8fad !important;white-space:nowrap;transition:color .15s}",
      "html body #page button.fo-sqx-tab:hover{background:transparent !important;color:#c6d3e8 !important;border-color:transparent !important}",
      "html body #page button.fo-sqx-tab.on{color:var(--gold) !important}",
      "html body #page button.fo-sqx-tab.on:after{content:'';position:absolute;left:10px;right:10px;bottom:-1px;height:2px;background:var(--gold)}",
      ".fo-sqx-pane{padding:16px 18px 4px}",
      ".fo-sqx-ph{font-family:Oswald,sans-serif;text-transform:uppercase;letter-spacing:.2em;font-size:9.5px;color:#7d8fad;margin:0 0 10px}",
      ".fo-sqx-pcols{display:grid;grid-template-columns:1fr 1fr;gap:18px}",
      // attribute bars
      ".fo-sqx-attr{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:9px;margin-bottom:9px}",
      ".fo-sqx-attr .k{font-family:Oswald,sans-serif;text-transform:uppercase;letter-spacing:.1em;font-size:9.5px;color:#93a5c2;min-width:56px}",
      ".fo-sqx-attr .m{height:5px;border-radius:3px;background:rgba(126,158,208,.16);overflow:hidden}",
      ".fo-sqx-attr .m i{display:block;height:100%;border-radius:3px;background:linear-gradient(90deg,#C9A24B,var(--gold))}",
      ".fo-sqx-attr .v{font-family:Oswald,sans-serif;font-weight:600;font-size:12px;color:#f2f6ff;min-width:22px;text-align:right;font-variant-numeric:tabular-nums}",
      ".fo-sqx-attr.nil .v{color:#5f7392}.fo-sqx-attr.nil .m i{background:rgba(126,158,208,.28)}",
      // traits + stars
      ".fo-sqx-trait{display:flex;gap:8px;font-family:Georgia,serif;font-size:12.5px;line-height:1.45;color:#cbd6e8;margin-bottom:7px}",
      ".fo-sqx-trait s{color:var(--gold);text-decoration:none;line-height:1.2}",
      ".fo-sqx-stars{display:flex;gap:3px;font-size:17px;color:rgba(126,158,208,.3);margin-top:4px}",
      ".fo-sqx-stars .on{color:var(--gold)}",
      // form + condition
      ".fo-sqx-frow{display:grid;grid-template-columns:1fr auto;gap:18px;align-items:center;padding:14px 18px;border-top:1px solid rgba(126,158,208,.14)}",
      ".fo-sqx-pips{display:flex;gap:6px;flex-wrap:wrap}",
      ".fo-sqx-pip{font-family:Oswald,sans-serif;font-weight:600;font-size:12.5px;min-width:38px;text-align:center;padding:7px 6px;border-radius:7px;background:rgba(126,158,208,.16);color:#e7eefb;font-variant-numeric:tabular-nums}",
      ".fo-sqx-pip.hi{background:rgba(22,163,74,.28);color:#9CE8B4}",
      ".fo-sqx-pip.lo{background:rgba(180,45,45,.28);color:#F0A4A4}",
      ".fo-sqx-none{font-family:Georgia,serif;font-style:italic;font-size:12.5px;color:#6f819e}",
      ".fo-sqx-ring{position:relative;width:66px;height:66px;flex:0 0 auto}",
      ".fo-sqx-ring svg{transform:rotate(-90deg);display:block}",
      ".fo-sqx-ring circle{fill:none;stroke-width:5}",
      ".fo-sqx-ring .bg{stroke:rgba(126,158,208,.2)}",
      ".fo-sqx-ring .fg{stroke:var(--gold);stroke-linecap:round;transition:stroke-dasharray .5s ease}",
      ".fo-sqx-ring .fg.lo{stroke:#DC6A5A}",
      ".fo-sqx-ring b{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-family:Oswald,sans-serif;font-weight:700;font-size:14px;color:#f2f6ff}",
      ".fo-sqx-cond{display:flex;align-items:center;gap:11px}",
      ".fo-sqx-cond span{font-family:Oswald,sans-serif;text-transform:uppercase;letter-spacing:.14em;font-size:10px;color:#93a5c2}",
      // actions
      ".fo-sqx-acts{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:14px 18px 18px}",
      "html body #page button.fo-sqx-act{padding:13px 10px !important;border-radius:10px !important;cursor:pointer;font:600 10.5px Oswald,sans-serif !important;text-transform:uppercase;letter-spacing:.14em;transition:.15s}",
      "html body #page button.fo-sqx-act.ghost{background:transparent !important;border:1.5px solid rgba(126,158,208,.34) !important;color:#e7eefb !important}",
      "html body #page button.fo-sqx-act.ghost:hover{border-color:rgba(235,194,113,.7) !important;background:transparent !important;color:#fff !important}",
      "html body #page button.fo-sqx-act.solid{background:linear-gradient(180deg,#F0B94E,#C9A24B) !important;border:0 !important;color:#0d1526 !important;box-shadow:0 6px 18px rgba(235,194,113,.24)}",
      "html body #page button.fo-sqx-act.solid:hover{background:linear-gradient(180deg,#F5C566,#D4AC52) !important;color:#0d1526 !important;border-color:transparent !important;transform:translateY(-1px);box-shadow:0 10px 24px rgba(235,194,113,.34)}",
      "html body #page button.fo-sqx-act.solid.arm{background:linear-gradient(180deg,#5BD0A6,#2f9d78) !important;color:#062018 !important}",
      ".fo-sqx-hint{grid-column:1/-1;font-family:Georgia,serif;font-style:italic;font-size:12.5px;line-height:1.45;color:#8fd8bd;margin:0}",
      // ---- stacked ----
      // the list wants the whole width - there is no dossier beside it
      "#page .fo-sqx.listing .fo-sqx-in{grid-template-columns:minmax(0,1fr)}",
      // phones: the bars are what make the row wide, so the numbers carry the
      // colour instead and every column fits without a sideways scroll
      "@media(max-width:760px){.fo-sqt{min-width:0}.fo-sqt-cap{font-size:12px}",
      ".fo-sqt td,html body.ftpskin #page th.fo-sqt-h,html body #page th.fo-sqt-h{padding:9px 6px}",
      ".fo-sqt td{font-size:12.5px}",
      ".fo-sqt-bar{min-width:0;gap:0;justify-content:flex-end}.fo-sqt-bar u{display:none}",
      ".fo-sqt-bar b{font-size:12.5px;min-width:24px}",
      ".fo-sqt .c-age,.fo-sqt .c-field,.fo-sqt .c-fit{display:none}",
      ".fo-sqt-nm .lg{display:none}.fo-sqt-nm .sm{display:inline}",
      ".fo-sqt-h .lg{display:none}.fo-sqt-h .sm{display:inline}",
      "html body.ftpskin #page th.fo-sqt-h,html body #page th.fo-sqt-h{letter-spacing:.08em;font-size:8.5px}",
      ".fo-sqt-nm{font-size:13.5px}.fo-sqt-go{display:none}.fo-sqt td.c-name{width:42%}}",
      "@media(max-width:1180px){.fo-sqx-in{grid-template-columns:minmax(0,1fr);padding-top:58px}.fo-sqx-dos{position:static}",
      ".fo-sqx-rail{position:static;transform:none;flex-direction:row;flex-wrap:wrap;justify-content:center;margin:0 0 10px}",
      "html body #page button.fo-sqx-rb{flex-direction:row;width:auto;gap:7px;padding:8px 13px}.fo-sqx-rb b{font-size:13px}}",
      "@media(max-width:760px){.fo-sqx-in{padding:52px 10px 16px;gap:12px}.fo-sqx-parkin{padding:14px 10px 14px}",
      ".fo-sqx-field{gap:6px;min-height:0;padding:8px 0 4px}.fo-sqx-row{gap:6px}",
      "html body #page button.fo-sqx-man{width:clamp(58px,20vw,76px)}",
      ".fo-sqx-man .nm{font-size:9px;padding:5px 3px 0}.fo-sqx-man .rl{font-size:7.5px}",
      ".fo-sqx-dfacts,.fo-sqx-did{max-width:100%}.fo-sqx-dart{opacity:.45;right:-14%}",
      ".fo-sqx-pcols{grid-template-columns:1fr;gap:14px}",
      ".fo-sqx-frow{grid-template-columns:1fr;gap:12px}.fo-sqx-acts{grid-template-columns:1fr}}"
    ].join("");
    document.head.appendChild(s);
  }

  window.pgSquad = function () {
    try {
      foSqxCss();
      var t = userTeam();
      (t.players || []).forEach(foEnsureTraining); (t.youth || []).forEach(foEnsureTraining);
      window.squadView = window.squadView || {};
      var sv = window.squadView;
      sv.mode = sv.mode || "xi"; sv.tab = ["ovr", "bat", "bwl", "fld", "rec"].indexOf(sv.tab) >= 0 ? sv.tab : "ovr";
      // the park picks a side; the list judges it. Two complete views, one page.
      sv.view = sv.view === "list" ? "list" : "park";
      sv.sortK = sv.sortK || "ovr"; sv.sortDir = sv.sortDir === 1 ? 1 : -1;
      var seniors = (t.players || []).map(function (p) { return Object.assign({}, p); });
      var youths = (t.youth || []).map(function (p) { return Object.assign({ __y: true }, p); });
      var byName = {}; seniors.concat(youths).forEach(function (p) { byName[p.name] = p; });

      // the XI: whatever the orders already say, otherwise the side the engine
      // would pick itself, so the park never opens on a lineup nobody chose
      if (!sv.xi || sv.xi.length !== 11 || sv.xi.some(function (n) { return !byName[n] || byName[n].__y; })) {
        var base = null;
        try { if (typeof App !== "undefined" && App.orders && App.orders.xi && App.orders.xi.length === 11) base = App.orders.xi.slice(); } catch (eO) {}
        if (!base || base.some(function (n) { return !byName[n] || byName[n].__y; })) {
          try { base = pickXI(t).map(function (p) { return p.name; }); } catch (eP) { base = null; }
        }
        sv.xi = (base && base.length === 11) ? base : seniors.slice(0, 11).map(function (p) { return p.name; });
      }
      var xiSet = {}; sv.xi.forEach(function (n) { xiSet[n] = 1; });
      var xi = sv.xi.map(function (n) { return byName[n]; }).filter(Boolean);
      var bench = seniors.filter(function (p) { return !xiSet[p.name]; }).concat(youths);

      // captain: whoever the orders name, else the best head in the XI
      var capt = null;
      try { capt = (typeof App !== "undefined" && App.orders && App.orders.captain) || null; } catch (eC) {}
      if (!capt || !xiSet[capt]) capt = xi.slice().sort(function (a, b) { return (b.capt || 0) - (a.capt || 0); })[0];
      capt = capt && capt.name ? capt.name : capt;

      if (!sv.sel || !byName[sv.sel]) sv.sel = xi.length ? xi[0].name : (seniors[0] && seniors[0].name);
      var sel = byName[sv.sel];

      var bal = { bat: 0, bowl: 0, ar: 0, wk: 0 };
      xi.forEach(function (p) { var c = foSqClass(p); bal[c] = (bal[c] || 0) + 1; });
      var bowlOpts = xi.filter(function (p) { return p.bowlType; }).length;
      var enAvg = xi.length ? Math.round(xi.reduce(function (s2, p) { return s2 + foEnergyOf(p).pct; }, 0) / xi.length) : 0;

      // a man on the park, or on the bench
      var manHTML = function (p, n) {
        if (!p) return "";
        var cls = foSqClass(p), en = foEnergyOf(p);
        var lbl = cls === "wk" ? "WK" : cls === "ar" ? "AR" : cls === "bowl" ? "BOWL" : "BAT";
        var sub = lbl, extra = "";
        if (sv.mode === "roles") sub = (foPkRoleLbl(p) || lbl).toUpperCase().slice(0, 12);
        else if (sv.mode === "cond") { sub = en.pct + "% " + en.word.toUpperCase(); extra = "<span class='en" + (en.tired ? " lo" : "") + "'><i style='width:" + en.pct + "%'></i></span>"; }
        else if (sv.mode === "bal") sub = (cls === "bowl" || cls === "ar") ? "BOWLS" : cls === "wk" ? "GLOVES" : "BATS ONLY";
        var swap = sv.arm && ((xiSet[p.name] && !xiSet[sv.arm]) || (!xiSet[p.name] && xiSet[sv.arm])) && p.name !== sv.arm && !p.__y;
        return "<button type='button' class='fo-sqx-man" + (p.name === sv.sel ? " sel" : "") + (swap ? " tgt" : "") + "' data-n='" + E(p.name) + "'>" +
          (n ? "<span class='no'>" + n + "</span>" : "") +
          (p.name === capt ? "<span class='cap'>C</span>" : "") +
          "<img class='pic' src='" + FO_ART + foPkArt(p) + "' alt='' loading='lazy' decoding='async'>" + extra +
          "<span class='nm'>" + E(foSqShortName(p.name)) + "</span>" +
          "<span class='rl " + cls + "'>" + E(sub) + "</span></button>";
      };

      var rows = FO_SQ_ROWS.map(function (r) {
        return "<div class='fo-sqx-row'>" + r.map(function (ix) { return manHTML(xi[ix], ix + 1); }).join("") + "</div>";
      }).join("");

      var railBtn = function (id, ic, big, lbl) {
        return "<button type='button' class='fo-sqx-rb" + (sv.mode === id ? " on" : "") + "' data-mode='" + id + "'>" +
          (big ? "<b>" + big + "</b>" : "<span class='ic'>" + ic + "</span>") + lbl + "</button>";
      };
      var rail = "<div class='fo-sqx-rail'>" +
        railBtn("xi", "", xi.length + "/11", "XI") +
        railBtn("bal", "&#9878;", "", "Balance") +
        railBtn("roles", "&#9678;", "", "Roles") +
        railBtn("cond", "&#9825;", "", "Conditions") + "</div>";

      var read = "";
      if (sv.mode === "bal") {
        read = "<b>" + (bal.bat + bal.ar + bal.wk) + "</b> can bat <i>&middot;</i> <b>" + bowlOpts + "</b> can bowl <i>&middot;</i> <b>" + (bal.wk || 0) + "</b> keeper" + (bal.wk === 1 ? "" : "s") +
          (bowlOpts < 5 ? " <span class='warn'>&#9888; fewer than five bowlers - the engine will re-pick</span>" : "") +
          (!bal.wk ? " <span class='warn'>&#9888; no keeper in the XI</span>" : "");
      } else if (sv.mode === "roles") {
        read = "<b>" + (bal.bat || 0) + "</b> batters <i>&middot;</i> <b>" + (bal.ar || 0) + "</b> all-rounders <i>&middot;</i> <b>" + (bal.bowl || 0) + "</b> bowlers <i>&middot;</i> <b>" + (bal.wk || 0) + "</b> keeper" + (bal.wk === 1 ? "" : "s");
      } else if (sv.mode === "cond") {
        var tired = xi.filter(function (p) { return foEnergyOf(p).tired; });
        read = "Average energy <b>" + enAvg + "%</b>" + (tired.length ? " <i>&middot;</i> <span class='warn'>" + tired.length + " tired: " + tired.map(function (p) { return E(foSqShortName(p.name)); }).join(", ") + "</span>" : " <i>&middot;</i> <em>everyone match fit</em>");
      } else {
        read = "<b>" + xi.length + "</b> named <i>&middot;</i> captain <em>" + E(foSqShortName(capt || "-")) + "</em> <i>&middot;</i> <b>" + bench.length + "</b> on the bench <i>&middot;</i> tap a man to read him";
      }

      // ---- the dossier ----
      var dos = "<div class='fo-sqx-dos'><div class='fo-sqx-pane fo-sqx-none'>Nobody selected.</div></div>";
      if (sel) {
        var selIx = sv.xi.indexOf(sel.name), en2 = foEnergyOf(sel), ovr = foPkOvr(sel);
        var flagSrc = "";
        try { flagSrc = FO_ART + "flags/" + ((typeof FO_FLAG_FILE !== "undefined" && FO_FLAG_FILE[foSqNatId(sel.nat)]) || foSqNatId(sel.nat)) + ".svg"; } catch (eF) {}
        var facts =
          "<dl class='fo-sqx-dfacts'>" +
          "<dt>Age</dt><dd>" + (sel.age | 0) + "</dd>" +
          "<dt>Batting</dt><dd>" + E(foSqBatStyle(sel)) + " &middot; " + (sel.hand === "L" ? "LHB" : "RHB") + "</dd>" +
          "<dt>Bowling</dt><dd>" + E(foSqBowlStyle(sel)) + "</dd>" +
          "<dt>Nation</dt><dd>" + (flagSrc ? "<img src='" + flagSrc + "' alt='' onerror=\"this.style.display='none'\">" : "") + E(sel.nat || "-") + "</dd>" +
          "</dl>";
        var tabs = [["ovr", "Overview"], ["bat", "Batting"], ["bwl", "Bowling"], ["fld", "Fielding"], ["rec", "Record"]].map(function (tb) {
          return "<button type='button' class='fo-sqx-tab" + (sv.tab === tb[0] ? " on" : "") + "' data-tab='" + tb[0] + "'>" + tb[1] + "</button>";
        }).join("");
        var pane = foSqPane(sv.tab, sel, ovr);

        var recent = foSqRecent(sel.name);
        var pips = recent.length
          ? recent.map(function (r) { return "<span class='fo-sqx-pip " + (r.r >= 50 ? "hi" : r.r < 20 ? "lo" : "") + "'>" + r.r + (r.no ? "*" : "") + "</span>"; }).join("")
          : "<span class='fo-sqx-none'>No innings yet - his form starts with the first match.</span>";
        var C = 2 * Math.PI * 28;
        var ring = "<div class='fo-sqx-cond'><div class='fo-sqx-ring'><svg width='66' height='66'>" +
          "<circle class='bg' cx='33' cy='33' r='28'></circle>" +
          "<circle class='fg" + (en2.tired ? " lo" : "") + "' cx='33' cy='33' r='28' stroke-dasharray='" + (C * en2.pct / 100).toFixed(1) + " " + C.toFixed(1) + "'></circle>" +
          "</svg><b>" + en2.pct + "%</b></div><span>" + (en2.tired ? "Needs a rest" : "Match fit") + "</span></div>";

        dos = "<aside class='fo-sqx-dos'>" +
          "<div class='fo-sqx-dhero'>" +
          "<img class='fo-sqx-dart' src='" + FO_ART + foPkArt(sel) + "' alt='' decoding='async'>" +
          "<div class='fo-sqx-did'>" +
          (selIx >= 0 ? "<div class='fo-sqx-dno'>" + ("0" + (selIx + 1)).slice(-2) + "</div>" : "<div class='fo-sqx-dno'>&mdash;</div>") +
          "<h2 class='fo-sqx-dnm'>" + E(sel.name) + "</h2>" +
          "<div class='fo-sqx-drole'>" + E(foPkRoleLbl(sel) || "Player") + " (" + (sel.hand === "L" ? "LHB" : "RHB") + ")</div>" +
          (sel.name === capt ? "<div class='fo-sqx-dcap'><u>C</u>Captain</div>"
            : sel.__y ? "<div class='fo-sqx-dcap'><u>Y</u>Youth</div>"
            : selIx < 0 ? "<div class='fo-sqx-dcap'><u>B</u>Bench</div>" : "") +
          "</div>" + facts +
          "</div>" +
          "<div class='fo-sqx-tabs'>" + tabs + "</div>" +
          "<div class='fo-sqx-pane'>" + pane + "</div>" +
          "<div class='fo-sqx-frow'><div><div class='fo-sqx-ph'>Recent form</div><div class='fo-sqx-pips'>" + pips + "</div></div>" + ring + "</div>" +
          "<div class='fo-sqx-acts'>" +
          "<button type='button' class='fo-sqx-act ghost' id='fo-sqx-view'>View full profile</button>" +
          (sel.__y
            ? "<button type='button' class='fo-sqx-act solid' id='fo-sqx-promote'>Promote to seniors</button>"
            : "<button type='button' class='fo-sqx-act solid" + (sv.arm === sel.name ? " arm" : "") + "' id='fo-sqx-sub'>" + (sv.arm === sel.name ? "Cancel swap" : "Make substitution") + "</button>") +
          (sv.arm ? "<p class='fo-sqx-hint'>" + E(foSqShortName(sv.arm)) + " is ready to swap - tap the man " + (xiSet[sv.arm] ? "on the bench" : "on the park") + " who changes places with him.</p>" : "") +
          "</div></aside>";
      }

      var page = document.getElementById("page"); if (!page) return;
      document.body.classList.add("fo-sqx-on");
      var bg = foSqGroundArt(t);
      var bgFallback = FO_ART + "home/hgm-dressing-room.webp";
      var nextLine = foSqNextMatch(t);

      var viewSwitch =
        "<div class='fo-sqx-views' role='tablist' aria-label='Squad view'>" +
        "<button type='button' class='fo-sqx-vb" + (sv.view === "park" ? " on" : "") + "' data-view='park' role='tab' aria-selected='" + (sv.view === "park") + "'>The park</button>" +
        "<button type='button' class='fo-sqx-vb" + (sv.view === "list" ? " on" : "") + "' data-view='list' role='tab' aria-selected='" + (sv.view === "list") + "'>The list</button>" +
        "</div>";

      var xiIx = function (p) { return sv.xi.indexOf(p.name); };
      var everyone = seniors.concat(youths);

      var parkBody =
        rail +
        "<div class='fo-sqx-field'>" + rows + "</div>" +
        "<div class='fo-sqx-read'>" + read + "</div>" +
        "<div class='fo-sqx-bench'>" +
        "<div class='fo-sqx-bhd'><b>Bench</b><span>" + bench.length + " available</span></div>" +
        (bench.length ? "<div class='fo-sqx-brow'>" + bench.map(function (p, i) { return manHTML(p, 12 + i); }).join("") + "</div>"
                      : "<div class='fo-sqx-bempty'>Everyone at the club is in the XI.</div>") +
        "</div>";

      var listBody = foSqTable(everyone, sv, capt, xiIx);

      page.innerHTML =
        "<div class='fo-sqx" + (sv.view === "list" ? " listing" : "") + "'><div class='fo-sqx-in'>" +
        "<section class='fo-sqx-park'>" +
        "<div class='fo-sqx-bg' style='background-image:url(" + bg + ")'></div><div class='fo-sqx-veil'></div>" +
        "<div class='fo-sqx-parkin'>" +
        "<header class='fo-sqx-hd'><h1>Squad</h1><div class='fo-sqx-tag'>Select your XI. Shape your legacy.</div>" +
        nextLine + viewSwitch + "</header>" +
        (sv.view === "list" ? listBody : parkBody) +
        "</div></section>" +
        (sv.view === "list" ? "" : dos) +
        "</div></div>";

      // ---- wiring ----
      // a background-image cannot report a 404, so test the ground before
      // trusting it and fall back to the dressing room rather than a black box
      (function () {
        var el = page.querySelector(".fo-sqx-bg"); if (!el) return;
        var probe = new Image();
        probe.onerror = function () { el.style.backgroundImage = "url(" + bgFallback + ")"; };
        probe.src = bg;
      })();

      page.querySelectorAll(".fo-sqx-vb").forEach(function (b) {
        b.addEventListener("click", function () { sv.view = b.getAttribute("data-view"); pgSquad(); });
      });
      // sorting: same column flips direction, a new column starts descending
      // (best first), except the name, where A-Z is what anyone expects
      page.querySelectorAll(".fo-sqt-h").forEach(function (h) {
        h.addEventListener("click", function () {
          var k = h.getAttribute("data-sort");
          if (k === sv.sortK) sv.sortDir = -sv.sortDir;
          else { sv.sortK = k; sv.sortDir = (k === "name" || k === "pos" || k === "age") ? 1 : -1; }
          pgSquad();
        });
      });
      // every row is a door to the man's full profile
      var openMan = function (n) { if (n) location.hash = "#/player?n=" + encodeURIComponent(n); };
      page.querySelectorAll(".fo-sqt-r").forEach(function (r) {
        r.addEventListener("click", function () { openMan(r.getAttribute("data-n")); });
        r.addEventListener("keydown", function (e) {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openMan(r.getAttribute("data-n")); }
        });
      });
      page.querySelectorAll(".fo-sqx-rb").forEach(function (b) {
        b.addEventListener("click", function () { sv.mode = b.getAttribute("data-mode"); pgSquad(); });
      });
      page.querySelectorAll(".fo-sqx-tab").forEach(function (b) {
        b.addEventListener("click", function () { sv.tab = b.getAttribute("data-tab"); pgSquad(); });
      });
      page.querySelectorAll(".fo-sqx-man").forEach(function (b) {
        b.addEventListener("click", function () {
          var n = b.getAttribute("data-n");
          // a swap is armed: this tap either completes it or just re-reads the man
          if (sv.arm && sv.arm !== n && byName[n] && !byName[n].__y &&
              ((xiSet[sv.arm] && !xiSet[n]) || (!xiSet[sv.arm] && xiSet[n]))) {
            var inN = xiSet[sv.arm] ? n : sv.arm, outN = xiSet[sv.arm] ? sv.arm : n;
            var at = sv.xi.indexOf(outN);
            if (at >= 0) { sv.xi[at] = inN; foSqCommitXI(sv.xi, outN); }
            sv.arm = null; sv.sel = inN; pgSquad(); return;
          }
          sv.sel = n; pgSquad();
        });
      });
      var vb = page.querySelector("#fo-sqx-view");
      if (vb) vb.addEventListener("click", function () { location.hash = "#/player?n=" + encodeURIComponent(sv.sel); });
      var sb = page.querySelector("#fo-sqx-sub");
      if (sb) sb.addEventListener("click", function () { sv.arm = (sv.arm === sv.sel) ? null : sv.sel; pgSquad(); });
      var pb = page.querySelector("#fo-sqx-promote");
      if (pb) pb.addEventListener("click", function () {
        try { promoteYouth(App.teamIx, sv.sel); } catch (ePy) {}
        sv.xi = null; sv.sel = null; pgSquad();
      });
    } catch (e) { console.warn("pgSquad", e); }
  };

  // the XI chosen here is the XI that takes the field, so it goes straight into
  // the orders the match engine reads - and the armband moves if its man drops out
  function foSqCommitXI(xi, droppedName) {
    try {
      if (typeof App === "undefined" || !App) return;   // App is a const global, never on window
      App.orders = App.orders || {};
      App.orders.xi = xi.slice();
      if (droppedName && App.orders.captain === droppedName) App.orders.captain = null;
      if (droppedName && App.orders.keeper === droppedName) App.orders.keeper = null;
      if (typeof saveGame === "function") saveGame();
    } catch (e) {}
  }
  function foSqShortName(n) {
    var parts = String(n || "").trim().split(/\s+/);
    return parts.length > 1 ? (parts[0].charAt(0) + ". " + parts[parts.length - 1]) : (parts[0] || "");
  }
  function foSqNatId(nat) {
    var m = { ENG: "eng", AUS: "aus", IND: "sub", RSA: "rsa", SA: "rsa", NZL: "nzl", NZ: "nzl", WIN: "win", WI: "win", IRE: "ire", IRL: "ire", NED: "ned", NL: "ned", PAK: "pak", SLK: "slk", SL: "slk", AFG: "afg", ZIM: "zim", BAN: "bgd", BGD: "bgd", NEP: "nep", SCO: "sco", WAL: "wal", KEN: "ken", USA: "usa", CAN: "can" };
    return m[String(nat || "").toUpperCase()] || String(nat || "").toLowerCase();
  }
  // The home ground, painted. Seven of the ten grounds have their own city art;
  // the other three borrow the nearest ground in the same country rather than
  // dropping the side onto a black rectangle.
  var FO_SQ_GROUND_CITY = {
    "Headingley": "leeds", "The Oval": "london", "Sydney Cricket Ground": "sydney",
    "Eden Park": "auckland", "Basin Reserve": "wellington", "Queen's Park Oval": "port-of-spain",
    "Wankhede Stadium": "mumbai",
    "M. Chinnaswamy Stadium": "chennai",   // Bengaluru is unpainted - nearest Indian ground
    "National Stadium": "lahore",          // Karachi is unpainted - nearest Pakistani ground
    "SuperSport Park": "johannesburg"      // Centurion is unpainted - nearest South African ground
  };
  function foSqGroundArt(t) {
    var slug = FO_SQ_GROUND_CITY[(t && t.ground) || ""] || "";
    if (!slug) {
      var city = (t && t.city) || "";
      try { slug = city ? foCitySlug(city) : ""; } catch (eS) { slug = String(city).toLowerCase().replace(/\s+/g, "-"); }
    }
    return slug ? (FO_ART + "cities/" + slug + "-ground.webp") : (FO_ART + "home/hgm-dressing-room.webp");
  }
  function foSqNextMatch(t) {
    var opp = "", ground = (t && t.ground) || "", wx = "";
    try {
      var fx = (typeof nextFixture === "function") ? nextFixture() : null;
      if (fx) {
        opp = (fx.opp && fx.opp.name) || "";
        ground = fx.venue || ground;
        wx = fx.weather || "";
        if (!fx.isHome && opp) opp = opp + " (away)";
      }
    } catch (eN) {}
    var bits = "<b>Next match</b>";
    bits += opp ? "<span>vs " + E(opp) + "</span>" : "<span>No fixture scheduled</span>";
    if (ground) bits += "<i>&middot;</i><span>" + E(ground) + "</span>";
    if (wx) bits += "<i>&middot;</i><span>" + E(wx) + "</span>";
    return "<div class='fo-sqx-next'>" + bits + "</div>";
  }
  // one tab's worth of the man, all of it read off his real skills
  function foSqPane(tab, p, ovr) {
    var s = S(p);
    var bar = function (k, v, nil) {
      v = Math.max(0, Math.round(v || 0));
      return "<div class='fo-sqx-attr" + (nil ? " nil" : "") + "'><span class='k'>" + k + "</span>" +
        "<span class='m'><i style='width:" + Math.min(100, v) + "%'></i></span><span class='v'>" + (nil ? "&ndash;" : v) + "</span></div>";
    };
    if (tab === "bat") {
      return "<div class='fo-sqx-pcols'><div><div class='fo-sqx-ph'>With the bat</div>" +
        bar("Overall", aggBat(p)) + bar("vs pace", s.vsPace) + bar("vs spin", s.vsSpin) +
        bar("Power", s.power) + bar("Rotation", s.rotation) + bar("Temperament", s.temperament) + "</div>" +
        "<div><div class='fo-sqx-ph'>How he plays</div>" +
        "<div class='fo-sqx-trait'><s>&#9670;</s><span>" + E(foSqBatStyle(p)) + " &middot; " + (p.hand === "L" ? "left hand" : "right hand") + "</span></div>" +
        "<div class='fo-sqx-trait'><s>&#9670;</s><span>Experience: " + E(p.expWord || p.exp || "-") + "</span></div>" +
        "<div class='fo-sqx-trait'><s>&#9670;</s><span>Form: " + E(p.formWord || "steady") + "</span></div>" +
        "</div></div>";
    }
    if (tab === "bwl") {
      if (!p.bowlType) {
        return "<div class='fo-sqx-ph'>With the ball</div><p class='fo-sqx-none'>" + E(p.name.split(" ").slice(-1)[0]) +
          " does not bowl. He is in the side for his batting" + (aggField(p) >= 60 ? " and his fielding." : ".") + "</p>";
      }
      return "<div class='fo-sqx-pcols'><div><div class='fo-sqx-ph'>With the ball</div>" +
        bar("Overall", aggBowl(p)) + bar("Wicket", s.wicket) + bar("Economy", s.economy) +
        bar("Discipline", s.discipline) + bar("Move / turn", s.moveTurn) + bar("Variation", s.variation) + "</div>" +
        "<div><div class='fo-sqx-ph'>His type</div>" +
        "<div class='fo-sqx-trait'><s>&#9670;</s><span>" + E(foSqBowlStyle(p)) + "</span></div>" +
        bar("Stamina", s.stamina) + "</div></div>";
    }
    if (tab === "fld") {
      var glove = (p.keeper || aggKeep(p) >= 20);
      return "<div class='fo-sqx-pcols'><div><div class='fo-sqx-ph'>In the field</div>" +
        bar("Overall", aggField(p)) + bar("Ground", s.fielding) + bar("Catching", s.catching) + "</div>" +
        "<div><div class='fo-sqx-ph'>" + (glove ? "With the gloves" : "Behind the stumps") + "</div>" +
        (glove ? bar("Keeping", s.keeping) + bar("Stumping", s.stumping)
               : "<p class='fo-sqx-none'>Not a keeper.</p>") + "</div></div>";
    }
    if (tab === "rec") {
      var n = null;
      try { n = (typeof foSeasonNumbers === "function") ? foSeasonNumbers(p.name) : null; } catch (eR) {}
      if (!n || !n.matches) {
        return "<div class='fo-sqx-ph'>This season</div><p class='fo-sqx-none'>No matches yet. Once he plays, his runs, wickets and best performances collect here.</p>";
      }
      var line = function (k, v) { return "<div class='fo-sqx-attr'><span class='k'>" + k + "</span><span class='m'></span><span class='v'>" + v + "</span></div>"; };
      return "<div class='fo-sqx-pcols'><div><div class='fo-sqx-ph'>Batting</div>" +
        line("Matches", n.matches) + line("Runs", n.runs) +
        line("Average", n.avg != null ? n.avg.toFixed(1) : "&ndash;") +
        line("Strike rate", n.sr != null ? n.sr.toFixed(0) : "&ndash;") + line("Best", n.best) + "</div>" +
        "<div><div class='fo-sqx-ph'>Bowling</div>" +
        (n.overs ? line("Wickets", n.wkts) + line("Average", n.bowlAvg != null ? n.bowlAvg.toFixed(1) : "&ndash;") +
                   line("Economy", n.econ != null ? n.econ.toFixed(2) : "&ndash;")
                 : "<p class='fo-sqx-none'>Has not bowled this season.</p>") + "</div></div>";
    }
    // overview
    var attrs = foSqAttrs(p).map(function (a) { return bar(a[0], a[1], a[0] === "Bowling" && !p.bowlType); }).join("");
    var traits = (p.talents || []).map(function (tl) {
      return "<div class='fo-sqx-trait'><s>&#9670;</s><span>" + E((typeof TALN !== "undefined" && TALN[tl]) || tl) + "</span></div>";
    }).join("") || "<p class='fo-sqx-none'>No standout traits - a dependable squad man.</p>";
    return "<div class='fo-sqx-pcols'>" +
      "<div><div class='fo-sqx-ph'>Attribute summary</div>" + attrs + "</div>" +
      "<div><div class='fo-sqx-ph'>Player traits</div>" + traits +
      "<div class='fo-sqx-ph' style='margin-top:14px'>Overall</div>" +
      "<div class='fo-sqx-stars'>" + foSqStars(ovr) + "</div></div></div>";
  }
  // restore the normal app column when leaving the squad
  window.addEventListener("hashchange", function () { if ((location.hash || "").split("?")[0] !== "#/squad") document.body.classList.remove("fo-sqx-on"); });

  // =========================================================================
  // Match lab (reviewer pass on Nets). The page answers "which choice should
  // I make?" instead of "what happened in 100 balls": a one-click intent
  // sweep (4 intents x 1,000 balls, common random numbers) with RPO and
  // out-every-N-overs per column, a hedged verdict in prose, honest sample
  // sizes, a Load-next-match preset, and an apply-to-orders hook. Plumbing
  // (seed, ball count, clubs, condition dropdowns) lives behind Advanced.
  // =========================================================================
  try {
    var foLabCss = document.createElement("style");
    foLabCss.textContent =
      ".fo-lab-head{display:flex;align-items:center;gap:10px;margin:8px 0 12px;flex-wrap:wrap}" +
      ".fo-lab-head h2{margin:0;font-size:22px;color:#0E233F}" +
      ".fo-lab-head .fo-lab-note{color:#8a93a3;font-size:12.5px}" +
      ".fo-lab-head .fo-lab-acts{margin-left:auto;display:flex;gap:8px}" +
      ".fo-lab-btn{border:1px solid rgba(28,36,51,.2);background:#FFFEFC;color:#0E233F;border-radius:9px;padding:8px 14px;font-size:12.5px;font-weight:700;cursor:pointer}" +
      "html body.ftpskin button.fo-lab-btn{background:#FFFEFC !important;color:#0E233F !important;border-color:rgba(28,36,51,.2) !important}" +
      "html body.ftpskin button.fo-lab-btn.on{background:#0E233F !important;color:#fff !important}" +
      ".fo-lab-chips{display:flex;gap:7px;flex-wrap:wrap;margin:10px 0}" +
      ".fo-lab-chip{border:1px solid rgba(28,36,51,.14);border-radius:999px;padding:6px 13px;font-size:12px;font-weight:700;color:#3a4353;background:#FFFEFC;cursor:pointer;box-shadow:0 1px 3px rgba(7,22,46,.05);transition:border-color .12s ease,color .12s ease}" +
      ".fo-lab-chip:hover{border-color:#C95532;color:#C95532}" +
      ".fo-lab-adv{background:#FFFEFC;border:1px solid rgba(28,36,51,.1);border-radius:12px;padding:14px 16px 12px;margin:10px 0 0;display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px 14px;align-items:end;box-shadow:0 2px 10px rgba(7,22,46,.04)}" +
      ".fo-lab-adv .fo-nc label{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
      ".fo-lab-adv select,.fo-lab-adv input{height:36px;box-sizing:border-box}" +
      ".fo-lab-advnote{font-size:11.5px;color:#8a93a3;margin:6px 2px 10px}" +
      ".fo-lab-actions{display:flex;gap:10px;margin:14px 0;flex-wrap:wrap}" +
      ".fo-lab-actions .fo-lab-go{border:1px solid rgba(28,36,51,.2);background:#FFFEFC;color:#0E233F;border-radius:10px;padding:11px 18px;font-size:13.5px;font-weight:800;cursor:pointer}" +
      ".fo-lab-actions .fo-lab-go.primary{background:#C95532;border-color:#C95532;color:#FFFEFC}" +
      "html body.ftpskin button.fo-lab-go{background:#FFFEFC !important;color:#0E233F !important;border-color:rgba(28,36,51,.2) !important}" +
      "html body.ftpskin button.fo-lab-go.primary{background:#C95532 !important;border-color:#C95532 !important;color:#FFFEFC !important}" +
      ".fo-lab-sweeph{font-size:13px;font-weight:800;color:#0E233F;margin:14px 0 8px}" +
      ".fo-lab-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}" +
      ".fo-lab-card{background:#FFFEFC;border:1px solid rgba(28,36,51,.1);border-radius:12px;padding:15px 17px;cursor:pointer;transition:box-shadow .12s ease,border-color .12s ease;box-shadow:0 2px 10px rgba(7,22,46,.04)}" +
      ".fo-lab-card:hover{box-shadow:0 3px 14px rgba(7,22,46,.1)}" +
      ".fo-lab-card.on{border-color:#C95532;box-shadow:0 0 0 2px rgba(201,85,50,.25)}" +
      ".fo-lab-card h5{margin:0 0 6px;font-size:12px;letter-spacing:.05em;text-transform:uppercase;color:#8a93a3}" +
      ".fo-lab-rpo{font-size:27px;font-weight:800;color:#0E233F;letter-spacing:-.01em}.fo-lab-rpo i{font-style:normal;font-size:12px;color:#8a93a3;font-weight:600;margin-left:4px}" +
      ".fo-lab-sub{font-size:12px;color:#5a6472;margin-top:5px;line-height:1.5}" +
      ".fo-lab-read{background:#F0F4F8;border:1px solid rgba(31,78,107,.18);border-radius:12px;padding:14px 16px;margin:12px 0;font-size:13.5px;line-height:1.6;color:#243244}" +
      ".fo-lab-read b{color:#0E233F}" +
      ".fo-lab-read .fo-lab-apply{margin-top:10px;display:flex;gap:8px;align-items:center;flex-wrap:wrap}" +
      ".fo-lab-hon{font-size:11.5px;color:#8a93a3;margin:6px 2px 14px}" +
      ".fo-lab-res{background:#FFFEFC;border:1px solid rgba(28,36,51,.1);border-radius:12px;padding:16px 18px;margin:12px 0;box-shadow:0 2px 10px rgba(7,22,46,.04)}" +
      ".fo-lab-res3{display:grid;grid-template-columns:190px 1fr 1fr;gap:18px;align-items:center}" +
      ".fo-lab-sw{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:7px;vertical-align:-1px}" +
      "@media(max-width:760px){.fo-lab-res3{grid-template-columns:1fr}}" +
      ".fo-lab-res table{font-size:12.5px}" +
      ".fo-lab-nudge{background:#F6E3B4;border:1px solid #e8cf8c;border-radius:9px;padding:8px 12px;font-size:12.5px;color:#5a4310;font-weight:600;margin-top:10px}" +
      "@media(max-width:900px){.fo-lab-grid{grid-template-columns:1fr 1fr}}" +
      "@media(max-width:520px){.fo-lab-grid{grid-template-columns:1fr}}";
    document.head.appendChild(foLabCss);
  } catch (e) {}

  var FO_LAB_COL = { dot: "#9aa3b2", "1": "#7cb87c", "2": "#5aa05a", "3": "#3f8f3f", "4": "#2d6a8f", "6": "#1c5537", wicket: "#DC2626", extras: "#F59E0B" };
  var FO_INTENTS = [[-1, "Defend"], [0, "Normal"], [1, "Attack"], [2, "Launch"]];
  function foLabPhase(over) { return over < 10 ? "pp" : over >= 40 ? "death" : "mid"; }
  function foLabPhaseName(over) { return over < 10 ? "powerplay" : over >= 40 ? "death overs" : "middle overs"; }
  function foLabPools() {
    // nets are for YOUR squad only · an opponent in the nets would lay their
    // hidden skill card on the table
    netsState.batClub = App.teamIx; netsState.bowlClub = App.teamIx;
    var bt = userTeam(), wt = userTeam();
    var batPool = (bt.players || []).slice().sort(function (a, b) { return aggBat(b) - aggBat(a); });
    var bowlPool = (wt.players || []).filter(function (p) { return p.bowlType; }).sort(function (a, b) { return aggBowl(b) - aggBowl(a); });
    if (!batPool.some(function (p) { return p.name === netsState.bat; })) netsState.bat = batPool.length ? batPool[0].name : null;
    if (!bowlPool.some(function (p) { return p.name === netsState.bowl; })) netsState.bowl = bowlPool.length ? bowlPool[0].name : null;
    return { batPool: batPool, bowlPool: bowlPool };
  }
  function foLabRun(intent, n) {
    var b = (findPlayer(netsState.bat) || {}).p, w = (findPlayer(netsState.bowl) || {}).p;
    if (!b || !w) return null;
    var R = runNets(b, w, n, { over: netsState.over, faced: netsState.faced, intent: intent, pitch: netsState.pitch, field: netsState.field, seed: netsState.seed, weather: netsState.weather });
    var overs = Math.max(0.001, R.legal / 6);
    R.rpo = R.runs / overs;
    R.outEvery = R.wkts ? overs / R.wkts : null;
    R.dotPct = 100 * (R.counts.dot || 0) / Math.max(1, R.legal);
    return R;
  }
  // hedged template prose over the four columns · thresholds, not cleverness
  function foLabVerdict(sw) {
    var by = {}; sw.forEach(function (s) { by[s.name] = s; });
    var d = by.Defend, n = by.Normal, a = by.Attack, l = by.Launch;
    var bowler = (findPlayer(netsState.bowl) || {}).p;
    var bnm = bowler ? bowler.name.split(" ").slice(-1)[0] : "The bowler";
    var ph = foLabPhaseName(netsState.over);
    var parts = [];
    if (d.rpo < n.rpo - 0.8) parts.push(bnm + " strangles passive play · defending earns just " + d.rpo.toFixed(1) + " an over");
    else parts.push("Defending still ticks along at " + d.rpo.toFixed(1) + " an over here, the lowest-risk floor");
    var dR = a.rpo - n.rpo;
    if (dR >= 0.8 && (a.outEvery == null || a.outEvery >= 8)) parts.push("attack is the sweet spot in the " + ph + ": +" + dR.toFixed(1) + " rpo over normal for acceptable added risk");
    else if (dR >= 0.8) parts.push("attack buys +" + dR.toFixed(1) + " rpo but costs a dismissal every " + Math.round(a.outEvery * 6) + " balls · spend wickets knowingly");
    else parts.push("attack adds little (+" + dR.toFixed(1) + " rpo over normal) · normal intent already gets most of the value");
    if (l.outEvery != null && l.outEvery < 6) parts.push("launch only when fewer than " + Math.max(2, Math.round(l.outEvery)) + " overs remain · a dismissal every " + Math.round(l.outEvery * 6) + " balls is a coin flip");
    else if (l.outEvery != null) parts.push("launch runs at " + l.rpo.toFixed(1) + " an over with a dismissal every " + Math.round(l.outEvery * 6) + " balls · viable for a final push");
    else parts.push("launch went undismissed in this sample · treat that as luck, not license");
    return parts.map(function (t) { return t.charAt(0).toUpperCase() + t.slice(1); }).join(". ") + ".";
  }
  function foLabOutEvery(R) {
    if (R.outEvery == null) return "No dismissal in " + R.legal.toLocaleString() + " balls";
    return "Out every " + Math.round(R.outEvery * 6) + " balls";
  }
  window.pgNets = function () {
    try {
      if (typeof netsState === "undefined" || typeof GD === "undefined" || !GD.teams) return;
      if (!netsState.__lab) {
        netsState.__lab = 1;
        netsState.batClub = App.teamIx; netsState.bowlClub = App.teamIx;
        netsState.bat = null; netsState.bowl = null;
        netsState.n = 1000; netsState.res = null; netsState.sweep = null; netsState.pick = null; netsState.adv = false;
      }
      var pools = foLabPools();
      var batP = (findPlayer(netsState.bat || "") || {}).p || null;
      var bowlP = (findPlayer(netsState.bowl || "") || {}).p || null;
      foNetsCss();

      var head = "<div class='fo-lab-head'><h2>Match lab</h2><span class='fo-lab-note'>· simulation only, no effect on players or fatigue</span>" +
        "<span class='fo-lab-acts'><button class='fo-lab-btn" + (netsState.adv ? " on" : "") + "' id='fo-lab-adv'>Advanced</button></span></div>";

      var cards = "<div id='fo-nets-cards'>" + foNetsCardHtml(batP, "bat") + "<div class='fo-net-v'>v</div>" + foNetsCardHtml(bowlP, "bowl") + "</div>";

      var chip = function (txt, tip) { return "<span class='fo-lab-chip' title='" + (tip || "Click to edit in Advanced") + "'>" + txt + "</span>"; };
      var phaseTxt = netsState.over >= 40 ? "Death · over " + netsState.over : netsState.over < 10 ? "New ball · over " + netsState.over : "Middle · over " + netsState.over;
      var facedTxt = netsState.faced >= 30 ? "Batter set (" + netsState.faced + ")" : netsState.faced > 0 ? "Getting in (" + netsState.faced + ")" : "Batter new";
      var chips = "<div class='fo-lab-chips' id='fo-lab-chips'>" +
        chip(phaseTxt) + chip(facedTxt) + chip(foPitchName(netsState.pitch) + " pitch") + chip(E(netsState.weather)) +
        chip({ bal: "Balanced field", att: "Attacking field", def: "Defensive field" }[netsState.field] || "Balanced field") +
        chip(netsState.n.toLocaleString() + " balls") + "</div>";

      var adv = "";
      if (netsState.adv) {
        var sel = function (id, label, opts, cur) {
          return "<div class='fo-nc'><label>" + label + "</label><select id='" + id + "'>" +
            opts.map(function (o) { return "<option value='" + o[0] + "'" + (String(cur) === String(o[0]) ? " selected" : "") + ">" + o[1] + "</option>"; }).join("") + "</select></div>";
        };
        adv = "<div class='fo-lab-adv'>" +
          sel("fo-la-over", "Over", [[2, "2 (new ball)"], [20, "20 (middle)"], [35, "35 (grip)"], [45, "45 (death)"]], netsState.over) +
          sel("fo-la-faced", "Batter is", [[0, "new (0 faced)"], [10, "getting in (10)"], [30, "set (30)"]], netsState.faced) +
          sel("fo-la-pitch", "Pitch", ["balanced", "flat", "green", "dry", "slow", "cracked", "twoPaced"].map(function (p) { return [p, foPitchName(p)]; }), netsState.pitch) +
          sel("fo-la-wx", "Weather", (typeof WXLIST !== "undefined" ? WXLIST : ["Sunny"]).map(function (w) { return [w, w]; }), netsState.weather) +
          sel("fo-la-field", "Field", [["bal", "Balanced"], ["att", "Attacking"], ["def", "Defensive"]], netsState.field) +
          sel("fo-la-n", "Balls (one session)", [[100, "100"], [1000, "1,000"]], netsState.n) +
          "<div class='fo-nc'><label title='Same seed replays the identical session'>Seed</label><input id='fo-la-seed' type='number' value='" + (+netsState.seed || 7) + "'></div>" +
          "</div><div class='fo-lab-advnote'>Same seed replays the identical session · change it to see a different draw of the same odds.</div>";
      }

      var actions = "<div class='fo-lab-actions'>" +
        "<button class='fo-lab-go' id='fo-lab-bowl'>Bowl one session</button>" +
        "<button class='fo-lab-go primary' id='fo-lab-sweep'>Sweep all intents &#8916;</button></div>";

      // ---- sweep grid + verdict ----
      var sweepHtml = "";
      if (netsState.sweep) {
        var sw = netsState.sweep;
        var minW = Math.min.apply(null, sw.map(function (s) { return s.wkts; }));
        var maxW = Math.max.apply(null, sw.map(function (s) { return s.wkts; }));
        sweepHtml = "<div class='fo-lab-sweeph'>Intent sweep · 1,000 balls each · same deliveries for every column</div><div class='fo-lab-grid'>" +
          sw.map(function (s) {
            return "<div class='fo-lab-card" + (netsState.pick === s.intent ? " on" : "") + "' data-i='" + s.intent + "' title='Click to select, then apply to orders'>" +
              "<h5>" + s.name + "</h5><div class='fo-lab-rpo'>" + s.rpo.toFixed(1) + "<i>rpo</i></div>" +
              "<div class='fo-lab-sub'>" + foLabOutEvery(s) + "<br>" + s.dotPct.toFixed(0) + "% dot</div></div>";
          }).join("") + "</div>" +
          "<div class='fo-lab-read'><b>&#128203; Read</b><br>" + foLabVerdict(sw) +
          "<div class='fo-lab-apply'>" +
          "<button class='fo-lab-btn' id='fo-lab-apply'" + (netsState.pick == null ? " disabled" : "") + ">" +
          (netsState.pick == null ? "Select a column to apply to orders" : "Apply " + FO_INTENTS.filter(function (x) { return x[0] === netsState.pick; })[0][1] + " to " + foLabPhaseName(netsState.over) + " orders &#8599;") +
          "</button></div></div>" +
          "<div class='fo-lab-hon'>&#9432; Dismissal rates from " + minW + "&ndash;" + maxW + " wickets per column · stable at 1,000 balls. A 100-ball run would carry a wide margin on these numbers.</div>";
      }

      // ---- single-session result ----
      var resHtml = "";
      if (netsState.res) {
        var R = netsState.res;
        var agg = { dot: 0, "1": 0, "2": 0, "3": 0, "4": 0, "6": 0, wicket: 0, extras: 0 }, dis = {};
        for (var k in R.counts) {
          if (isWkt(k)) { agg.wicket += R.counts[k]; dis[k] = R.counts[k]; }
          else if (["wide", "noball", "bye", "legbye"].indexOf(k) >= 0) agg.extras += R.counts[k];
          else agg[k] = (agg[k] || 0) + R.counts[k];
        }
        var overs1 = Math.max(0.001, R.legal / 6);
        var rpo1 = R.runs / overs1;
        var disTxt = Object.keys(dis).sort(function (a, b) { return dis[b] - dis[a]; }).map(function (k2) { return DFULL[k2] + " " + dis[k2]; }).join(", ") || "none";
        var outcome = ["dot", "1", "2", "3", "4", "6", "wicket", "extras"].filter(function (k2) { return agg[k2]; })
          .map(function (k2) { return "<tr><td><span class='fo-lab-sw' style='background:" + FO_LAB_COL[k2] + "'></span>" + (k2 === "dot" || k2 === "wicket" || k2 === "extras" ? k2 : k2 + " runs") + "</td><td class='r'>" + agg[k2] + "</td><td class='r'>" + (100 * agg[k2] / R.n).toFixed(1) + "%</td></tr>"; }).join("");
        // outcome pie · every delivery of the session in one glance
        var pie = (function () {
          var a0 = -Math.PI / 2, paths = "";
          ["dot", "1", "2", "3", "4", "6", "wicket", "extras"].forEach(function (k2) {
            var v = agg[k2]; if (!v) return;
            var a1 = a0 + 2 * Math.PI * v / R.n;
            var large = (a1 - a0) > Math.PI ? 1 : 0;
            var x0 = 90 + 80 * Math.cos(a0), y0 = 90 + 80 * Math.sin(a0), x1 = 90 + 80 * Math.cos(a1), y1 = 90 + 80 * Math.sin(a1);
            paths += (v === R.n) ? "<circle cx='90' cy='90' r='80' fill='" + FO_LAB_COL[k2] + "'/>"
              : "<path d='M90,90 L" + x0.toFixed(1) + "," + y0.toFixed(1) + " A80,80 0 " + large + " 1 " + x1.toFixed(1) + "," + y1.toFixed(1) + " Z' fill='" + FO_LAB_COL[k2] + "' stroke='#fff' stroke-width='1.5'/>";
            a0 = a1;
          });
          return "<svg viewBox='0 0 180 180' width='170' height='170' style='display:block;margin:auto'>" + paths + "</svg>";
        })();
        resHtml = "<div class='fo-lab-res'><div class='fo-lab-sweeph' style='margin-top:0'>One session · " + R.n.toLocaleString() + " balls · " + FO_INTENTS.filter(function (x) { return x[0] === netsState.intent; })[0][1] + " intent</div>" +
          "<div class='fo-lab-res3'>" +
          "<div>" + pie + "</div>" +
          "<table class='fo-tbl'><thead><tr><th>Outcome</th><th class='r'>Balls</th><th class='r'>%</th></tr></thead><tbody>" + outcome + "</tbody></table>" +
          "<table class='fo-kv'>" +
          "<tr><td>Run rate</td><td class='r'><b>" + rpo1.toFixed(1) + "</b> rpo (SR " + (R.legal ? (100 * R.runs / R.legal).toFixed(0) : "-") + ")</td></tr>" +
          "<tr><td>Dismissals</td><td class='r'><b>" + R.wkts + "</b> · " + (R.wkts ? "out every " + Math.round(R.legal / R.wkts) + " balls" : "none") + "</td></tr>" +
          "<tr><td>How out</td><td class='r'>" + E(disTxt) + "</td></tr>" +
          "<tr><td>Dot balls</td><td class='r'>" + (100 * (agg.dot || 0) / Math.max(1, R.legal)).toFixed(0) + "%</td></tr>" +
          "<tr><td>Boundary runs</td><td class='r'>" + (4 * (agg["4"] || 0) + 6 * (agg["6"] || 0)) + " of " + R.runs + "</td></tr>" +
          "</table></div>" +
          (R.n < 1000 && R.wkts <= 2 ? "<div class='fo-lab-nudge'>&#9888; Only " + R.wkts + " dismissal" + (R.wkts === 1 ? "" : "s") + " in this sample · the risk numbers are noise. Run 1,000 balls (or sweep) for a stable read.</div>" : "") +
          "</div>";
      }

      var page = document.getElementById("page"); if (!page) return;
      page.classList.add("fo-nets");
      page.innerHTML = head + cards + chips + adv + actions + sweepHtml + resHtml;

      // player selects live inside the skill cards
      var mkSel = function (kind, pool) {
        var s = document.createElement("select");
        s.innerHTML = pool.map(function (p) { return "<option" + (netsState[kind] === p.name ? " selected" : "") + ">" + E(p.name) + "</option>"; }).join("");
        s.addEventListener("change", function () { netsState[kind] = s.value; netsState.res = null; netsState.sweep = null; netsState.pick = null; pgNets(); });
        var slot = page.querySelector(".fo-net-slot[data-kind='" + kind + "']");
        if (slot) slot.appendChild(s);
      };
      mkSel("bat", pools.batPool); mkSel("bowl", pools.bowlPool);

      var on = function (id, ev, fn) { var el = page.querySelector("#" + id); if (el) el.addEventListener(ev, fn); };
      on("fo-lab-adv", "click", function () { netsState.adv = !netsState.adv; pgNets(); });
      page.querySelectorAll(".fo-lab-chip").forEach(function (c) { c.addEventListener("click", function () { netsState.adv = true; pgNets(); }); });
      var advWire = [["fo-la-over", "over", true], ["fo-la-faced", "faced", true], ["fo-la-pitch", "pitch", false], ["fo-la-wx", "weather", false], ["fo-la-field", "field", false], ["fo-la-n", "n", true]];
      advWire.forEach(function (w2) {
        on(w2[0], "change", function () {
          var el = page.querySelector("#" + w2[0]);
          netsState[w2[1]] = w2[2] ? +el.value : el.value;
          netsState.res = null; netsState.sweep = null; netsState.pick = null;
          pgNets();
        });
      });
      on("fo-la-seed", "change", function () { netsState.seed = +page.querySelector("#fo-la-seed").value || 7; });
      on("fo-lab-bowl", "click", function () {
        netsState.res = foLabRun(netsState.intent || 0, netsState.n);
        netsState.sweep = null; netsState.pick = null;
        pgNets();
      });
      on("fo-lab-sweep", "click", function () {
        netsState.sweep = FO_INTENTS.map(function (iv) {
          var R = foLabRun(iv[0], 1000);
          return R ? { intent: iv[0], name: iv[1], rpo: R.rpo, outEvery: R.outEvery, dotPct: R.dotPct, wkts: R.wkts, legal: R.legal } : null;
        }).filter(Boolean);
        netsState.res = null; netsState.pick = null;
        pgNets();
      });
      page.querySelectorAll(".fo-lab-card[data-i]").forEach(function (c) {
        c.addEventListener("click", function () { netsState.pick = +c.getAttribute("data-i"); pgNets(); });
      });
      on("fo-lab-apply", "click", function () {
        if (netsState.pick == null) return;
        var ph = foLabPhase(netsState.over);
        App.orders.phaseIntent = App.orders.phaseIntent || { pp: 0, mid: 0, death: 0 };
        App.orders.phaseIntent[ph] = netsState.pick;
        App.orders.saved = false;   // the change must go through the save-and-upload flow
        var nm = FO_INTENTS.filter(function (x) { return x[0] === netsState.pick; })[0][1];
        try { toast(nm + " set for the " + foLabPhaseName(netsState.over) + " · review and save your orders."); } catch (e) {}
        location.hash = "#/orders";
      });
    } catch (e) { console.warn("pgNets lab", e); }
  };
