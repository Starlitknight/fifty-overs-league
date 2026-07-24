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
  // === Squad — the trading-card gallery + selected-player detail rail =========
  function foSqxCss() {
    if (document.getElementById("fo-sqx-css")) return;
    var s = document.createElement("style"); s.id = "fo-sqx-css";
    s.textContent = [
      // full-bleed dark stage (widen the app's padded .wrap while mounted)
      "html body.fo-sqx-on .wrap{max-width:none !important;width:100% !important;padding:0 !important;margin:0 !important;background:transparent !important;box-shadow:none !important}",
      "#page .fo-sqx{position:relative;min-height:100vh;background:#0a1220;color:#eaf0fb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}",
      "#page .fo-sqx *{box-sizing:border-box}",
      // the backdrop is ABSOLUTE inside .fo-sqx (not fixed) so it covers the full
      // content height on a tall stacked mobile page, not just the first viewport
      ".fo-sqx-bg{position:absolute;inset:0;background-size:cover;background-position:center 22%;z-index:0;filter:blur(3px) brightness(.66) saturate(1.24) contrast(1.02);transform:scale(1.06)}",
      // an art-forward veil over the nation map: cinematic golden-hour top glow,
      // deepening toward the card so the holo cards read but the world stays present
      ".fo-sqx-veil{position:absolute;inset:0;background:radial-gradient(120% 70% at 50% -6%,rgba(120,150,190,.16),transparent 52%),linear-gradient(180deg,rgba(7,12,22,.5) 0%,rgba(7,11,20,.42) 30%,rgba(6,10,18,.6) 66%,rgba(5,9,16,.86) 100%);z-index:0}",
      ".fo-sqx-atmo{position:absolute;inset:0;z-index:0;pointer-events:none;opacity:.4;background-image:radial-gradient(1.5px 1.5px at 18% 24%,rgba(255,240,205,.9),transparent),radial-gradient(1.2px 1.2px at 72% 16%,rgba(255,255,255,.7),transparent),radial-gradient(1.6px 1.6px at 86% 52%,rgba(255,236,190,.8),transparent),radial-gradient(1.1px 1.1px at 38% 74%,rgba(255,255,255,.55),transparent),radial-gradient(1.3px 1.3px at 56% 40%,rgba(255,246,214,.7),transparent);animation:foSqxMote 12s ease-in-out infinite alternate}",
      "@keyframes foSqxMote{from{opacity:.24;transform:translateY(0)}to{opacity:.5;transform:translateY(-10px)}}",
      "@media(prefers-reduced-motion:reduce){.fo-sqx-atmo{animation:none}}",
      ".fo-sqx-in{position:relative;z-index:1;max-width:1520px;margin:0 auto;padding:10px 22px 14px;min-height:calc(100vh - 58px);display:flex;flex-direction:column}",
      // header
      ".fo-sqx-hd{display:flex;align-items:flex-end;gap:20px;margin:4px 0 14px;flex-wrap:wrap}",
      ".fo-sqx-title h1{font-family:Oswald,sans-serif;font-weight:700;text-transform:uppercase;letter-spacing:1px;font-size:clamp(30px,4vw,50px);line-height:.9;margin:0;color:#fff}",
      ".fo-sqx-sub{font-family:Oswald,sans-serif;letter-spacing:2px;text-transform:uppercase;font-size:12px;color:#8ea3c4;margin-top:6px}",
      ".fo-sqx-sub i{color:#586a86;font-style:normal;margin:0 3px}",
      ".fo-sqx-tabs{display:flex;gap:6px;margin-left:8px}",
      "html body #page .fo-sqx-tab{font-family:Oswald,sans-serif !important;font-weight:600 !important;letter-spacing:1.5px;font-size:12px;color:#c6d3e8 !important;background:rgba(12,20,36,.55) !important;border:1px solid rgba(126,158,208,.24) !important;border-radius:999px;padding:8px 16px;cursor:pointer;backdrop-filter:blur(8px);transition:.14s}",
      "html body #page .fo-sqx-tab:hover{color:#fff !important;background:rgba(20,30,50,.7) !important}",
      "html body #page .fo-sqx-tab.on{background:#EBC271 !important;color:#101b2d !important;border-color:#EBC271 !important}",
      ".fo-sqx-sort{margin-left:auto;font-family:Oswald,sans-serif;letter-spacing:1.5px;font-size:11px;color:#c6d3e8}",
      "html body #page .fo-sqx-sort select{font-family:Oswald,sans-serif !important;letter-spacing:1px;font-size:12px;background:rgba(12,20,36,.65) !important;color:#eaf0fb !important;border:1px solid rgba(126,158,208,.28) !important;border-radius:8px;padding:6px 10px;margin-left:4px;backdrop-filter:blur(8px)}",
      // body: gallery + rail
      ".fo-sqx-body{position:relative;display:block;flex:1;min-height:0}",
      // an arrow-driven carousel: the focused card is large & glowing, the rest
      // shrink and dim on either side. Scrollbar hidden — the arrows drive it
      // (touch swipe still works).
      ".fo-sqx-gallery{display:flex;gap:8px;overflow-x:auto;overflow-y:hidden;padding:12px calc(50% - 152px);align-items:center;scroll-behavior:smooth;scrollbar-width:none;-ms-overflow-style:none}",
      ".fo-sqx-gallery::-webkit-scrollbar{display:none;height:0;width:0}",
      // the phc renders at a comfortable native size (so its internal layout
      // never breaks) and the whole card is zoomed; the ART flexes so every card
      // is the same shape whatever its talent/meta count.
      ".fo-sqx-card{position:relative;flex:0 0 auto;cursor:pointer;zoom:.5;filter:brightness(.7) saturate(.85);opacity:.7;transition:zoom .2s ease,filter .2s ease,opacity .2s ease}",
      ".fo-sqx-card:hover{opacity:.92;filter:brightness(.9)}",
      ".fo-sqx-card.sel{zoom:.78;filter:none;opacity:1;z-index:2}",
      ".fo-sqx-card.sel .phc{box-shadow:0 0 0 3px rgba(235,194,113,.6),0 26px 64px -14px rgba(0,0,0,.85)}",
      ".fo-sqx-card .phc{width:392px !important;max-width:none !important;height:772px;margin:0;display:flex;flex-direction:column}",
      ".fo-sqx-card .phc-in{flex:1;min-height:0;display:flex;flex-direction:column}",
      ".fo-sqx-card .phc-art{height:auto !important;flex:1 1 auto;min-height:150px}",
      ".fo-sqx-card .phc-art img{width:100%;height:100%;object-fit:cover}",
      ".fo-sqx-card .phc-holo,.fo-sqx-card .phc-glare{display:none}",
      ".fo-sqx-card.inxi::after{content:'XI';position:absolute;top:16px;left:16px;z-index:5;font-family:Oswald,sans-serif;font-size:17px;font-weight:700;letter-spacing:1px;color:#101b2d;background:#EBC271;border-radius:7px;padding:3px 11px;box-shadow:0 3px 8px rgba(0,0,0,.45)}",
      ".fo-sqx-card.inxi .phc-role{padding-left:46px}",
      // carousel arrows
      "html body #page .fo-sqx-arrow{position:absolute;top:50%;transform:translateY(-50%);z-index:6;width:54px;height:54px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(10,18,32,.82) !important;border:1.5px solid rgba(235,194,113,.45) !important;color:#EBC271 !important;font-size:30px;line-height:0;padding-bottom:4px;cursor:pointer;backdrop-filter:blur(6px);box-shadow:0 8px 24px rgba(0,0,0,.5);transition:.14s}",
      ".fo-sqx-arrow:hover{background:#EBC271;color:#101b2d;border-color:#EBC271}",
      ".fo-sqx-arrow.prev{left:12px}.fo-sqx-arrow.next{right:12px}",
      ".fo-sqx-empty{color:#8ea3c4;padding:60px 20px;font-size:14px}",
      // detail rail
      ".fo-sqx-rail{background:linear-gradient(180deg,rgba(16,26,45,.82),rgba(10,16,30,.82));border:1px solid rgba(126,158,208,.16);border-radius:16px;padding:18px 18px 16px;position:sticky;top:14px;box-shadow:0 18px 50px -20px rgba(0,0,0,.8)}",
      ".fo-sqx-rh{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;padding-bottom:14px;border-bottom:1px solid rgba(126,158,208,.14)}",
      ".fo-sqx-rnm{font-family:Oswald,sans-serif;font-weight:700;text-transform:uppercase;font-size:24px;line-height:1;color:#fff}",
      ".fo-sqx-rrole{font-family:Oswald,sans-serif;letter-spacing:1.5px;font-size:11px;color:#EBC271;margin-top:5px}",
      ".fo-sqx-rnat{font-size:12px;color:#9bb0cf;margin-top:6px;display:flex;align-items:center;gap:6px}.fo-sqx-rnat img,.fo-sqx-rnat svg{width:18px;height:12px;border-radius:2px}",
      ".fo-sqx-rovr{text-align:center;flex:0 0 auto;border:1.5px solid rgba(235,194,113,.5);border-radius:12px;padding:6px 10px;background:rgba(235,194,113,.08)}",
      ".fo-sqx-rovr i{display:block;font-style:normal;font-family:Oswald,sans-serif;font-size:9px;letter-spacing:2px;color:#c9a24b}",
      ".fo-sqx-rovr b{font-family:Oswald,sans-serif;font-size:30px;line-height:1;color:#EBC271}",
      ".fo-sqx-sec{margin-top:15px}",
      ".fo-sqx-lbl{font-family:Oswald,sans-serif;letter-spacing:2px;text-transform:uppercase;font-size:10px;color:#8ea3c4;display:block;margin-bottom:8px}",
      ".fo-sqx-lbl em{font-style:normal;color:#586a86;letter-spacing:1px}",
      ".fo-sqx-pips{display:flex;gap:8px}",
      ".fo-sqx-pip{flex:1;text-align:center;font-family:Oswald,sans-serif;font-weight:600;font-size:14px;padding:8px 0;border-radius:9px;border:1.5px solid}",
      ".fo-sqx-pip.hi{color:#7ee0a0;border-color:rgba(126,224,160,.5);background:rgba(126,224,160,.1)}",
      ".fo-sqx-pip.mid{color:#EBC271;border-color:rgba(235,194,113,.5);background:rgba(235,194,113,.1)}",
      ".fo-sqx-pip.lo{color:#e8917f;border-color:rgba(232,145,127,.5);background:rgba(232,145,127,.1)}",
      ".fo-sqx-pip.empty{color:#4a5876;border-color:rgba(74,88,118,.4)}",
      ".fo-sqx-stam{display:flex;align-items:center;gap:10px}",
      ".fo-sqx-stam u{flex:1;height:9px;border-radius:6px;background:rgba(255,255,255,.1);overflow:hidden;display:block}",
      ".fo-sqx-stam u b{display:block;height:100%;border-radius:6px;background:linear-gradient(90deg,#22D3E0,#4DA6A2)}",
      ".fo-sqx-stam span{font-family:Oswald,sans-serif;font-size:15px;color:#fff}",
      ".fo-sqx-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}",
      ".fo-sqx-stats>div{background:rgba(255,255,255,.04);border:1px solid rgba(126,158,208,.14);border-radius:10px;padding:9px 6px;text-align:center}",
      ".fo-sqx-stats i{display:block;font-style:normal;font-family:Oswald,sans-serif;font-size:9px;letter-spacing:1.5px;color:#8ea3c4}",
      ".fo-sqx-stats b{font-family:Oswald,sans-serif;font-size:20px;color:#fff}",
      ".fo-sqx-mile .fo-sqx-milerow{display:flex;align-items:center;gap:10px;margin-bottom:8px}",
      ".fo-sqx-mile .star{color:#EBC271;font-size:18px}",
      ".fo-sqx-mile b{font-family:Oswald,sans-serif;font-size:13px;color:#fff;display:block;letter-spacing:.5px}",
      ".fo-sqx-mile i{font-style:normal;font-family:Oswald,sans-serif;font-size:12px;letter-spacing:1px;color:#EBC271}",
      ".fo-sqx-mbar{display:flex;align-items:center;gap:9px}",
      ".fo-sqx-mbar u{flex:1;height:7px;border-radius:5px;background:rgba(255,255,255,.1);overflow:hidden;display:block}",
      ".fo-sqx-mbar u b{display:block;height:100%;background:linear-gradient(90deg,#C9A24B,#EBC271)}",
      ".fo-sqx-mbar span{font-family:Oswald,sans-serif;font-size:10px;color:#8ea3c4;white-space:nowrap}",
      ".fo-sqx-cta{margin-top:16px;display:flex;flex-direction:column;gap:9px}",
      ".fo-sqx-cta button{font-family:Oswald,sans-serif;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;font-size:13px;border-radius:11px;padding:13px;cursor:pointer;border:none}",
      ".fo-sqx-viewp{background:linear-gradient(180deg,#C8674A,#a84e34);color:#fff;box-shadow:0 6px 18px -6px rgba(200,103,74,.6)}",
      ".fo-sqx-viewp:hover{filter:brightness(1.07)}",
      ".fo-sqx-xi,.fo-sqx-promote{background:transparent;color:#eaf0fb;border:1.5px solid rgba(126,158,208,.35) !important}",
      ".fo-sqx-xi:hover,.fo-sqx-promote:hover{border-color:#EBC271 !important;color:#EBC271}",
      // footer filter bar + balance
      ".fo-sqx-foot{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:12px 4px 4px;border-top:1px solid rgba(126,158,208,.14);margin-top:6px}",
      ".fo-sqx-rars{display:flex;gap:6px;flex-wrap:wrap}",
      "html body #page .fo-sqx-rar{font-family:Oswald,sans-serif !important;letter-spacing:1px;font-size:10.5px;color:#b9c6dd !important;background:rgba(12,20,36,.5) !important;border:1px solid rgba(126,158,208,.2) !important;border-radius:999px;padding:6px 12px;cursor:pointer;backdrop-filter:blur(6px);transition:.14s}",
      "html body #page .fo-sqx-rar:hover{color:#fff !important}",
      "html body #page .fo-sqx-rar.on{background:#EBC271 !important;color:#101b2d !important;border-color:#EBC271 !important}",
      ".fo-sqx-bal{margin-left:auto;font-family:Oswald,sans-serif;letter-spacing:1px;font-size:13px;color:#eaf0fb;display:flex;align-items:center;gap:7px}",
      ".fo-sqx-bal .lbl{font-size:10px;letter-spacing:2px;color:#8ea3c4;margin-right:4px}",
      ".fo-sqx-bal b{color:#EBC271}.fo-sqx-bal i{color:#586a86;font-style:normal}",
      "@media(max-width:900px){.fo-sqx-hd{gap:12px}.fo-sqx-sort{margin-left:0}.fo-sqx-card{zoom:.5}.fo-sqx-card.sel{zoom:.84}.fo-sqx-gallery{padding:12px calc(50% - 158px)}.fo-sqx-arrow{width:44px;height:44px;font-size:24px}}",
      // the focused-card counter under the rail
      ".fo-sqx-count{text-align:center;font-family:Oswald,sans-serif;letter-spacing:1px;color:#8ea3c4;font-size:14px;margin:2px 0 2px}",
      ".fo-sqx-count b{color:#EBC271;font-weight:700;font-size:17px}.fo-sqx-count s{color:#3f4d66;text-decoration:none;margin:0 2px}",
      ".fo-sqx-count em{display:block;font-style:normal;font-size:9.5px;letter-spacing:2px;color:#5a6b86;margin-top:2px}",
      // ------- mobile: a poster-like, single-hero reimagining -------
      "@media(max-width:600px){",
      "  #page .fo-sqx{background:#070c16}",
      "  .fo-sqx-veil{background:linear-gradient(180deg,rgba(7,12,22,.72) 0%,rgba(7,11,20,.34) 26%,rgba(7,11,20,.30) 58%,rgba(6,10,18,.82)) !important}",
      "  .fo-sqx-in{padding:8px 10px 12px}",
      "  .fo-sqx-hd{flex-direction:column;align-items:center;gap:10px;margin:2px 0 6px;text-align:center}",
      "  .fo-sqx-title h1{font-size:34px;letter-spacing:2px;text-shadow:0 2px 18px rgba(0,0,0,.6)}",
      "  .fo-sqx-sub{margin-top:3px;letter-spacing:2.5px}",
      "  .fo-sqx-tabs{margin-left:0;gap:7px;max-width:100%;overflow-x:auto;scrollbar-width:none;padding:2px;justify-content:flex-start;-webkit-overflow-scrolling:touch}",
      "  .fo-sqx-tabs::-webkit-scrollbar{display:none}",
      "  .fo-sqx-tab{flex:0 0 auto;padding:9px 18px;font-size:12.5px}",
      "  .fo-sqx-sort{margin:0}",
      "  .fo-sqx-body{margin:2px 0 0}",
      "  .fo-sqx-card{zoom:.62}.fo-sqx-card.sel{zoom:1}",
      "  .fo-sqx-gallery{padding:6px calc(50% - 168px);gap:2px}",
      "  .fo-sqx-arrow{width:40px;height:40px;font-size:22px;background:rgba(10,18,32,.6);border-color:rgba(235,194,113,.35)}",
      "  .fo-sqx-arrow.prev{left:2px}.fo-sqx-arrow.next{right:2px}",
      "  .fo-sqx-foot{justify-content:center;border-top:0;padding:6px 4px 2px}",
      "}"
    ].join("");
    (document.head || document.documentElement).appendChild(s);
  }

  // the selected-player detail rail (real career data + live form)
  function foSqxRail(p, inXi) {
    var tot = (typeof foClubTotals === "function") ? foClubTotals(p.name) : { runs: 0, wkts: 0, matches: 0, hs: 0 };
    var hist = ((App.playerHist && App.playerHist[p.name]) || []).filter(function (e) { return !e.fr; });
    var last5 = hist.slice(-5).map(function (e) { return +e.rr || 0; });
    while (last5.length < 5) last5.unshift(null);
    var pip = function (v) {
      if (v == null) return "<span class='fo-sqx-pip empty'>&ndash;</span>";
      var c = v >= 50 ? "hi" : v >= 25 ? "mid" : "lo";
      return "<span class='fo-sqx-pip " + c + "'>" + v + "</span>";
    };
    var en = foEnergyOf(p);
    var cls = foSqClass(p);
    // next milestone: career runs for batters/keepers/AR, career wickets for bowlers
    var mileHave, mileTarget, mileLbl;
    if (cls === "bowl") { mileHave = tot.wkts; mileTarget = Math.max(10, Math.ceil((tot.wkts + 1) / 10) * 10); mileLbl = mileTarget + " career wickets"; }
    else { mileHave = tot.runs; mileTarget = Math.max(250, Math.ceil((tot.runs + 1) / 250) * 250); mileLbl = mileTarget + " career runs"; }
    var away = Math.max(0, mileTarget - mileHave);
    var milePct = mileTarget ? Math.min(100, Math.round(mileHave / mileTarget * 100)) : 0;
    var avg = tot.matches ? (tot.runs / tot.matches).toFixed(1) : "0.0";
    var flag = (typeof foQsFlag === "function" ? foQsFlag(p.nat) : "") || "";
    return "" +
      "<div class='fo-sqx-rh'><div><div class='fo-sqx-rnm'>" + E(p.name) + "</div>" +
      "<div class='fo-sqx-rrole'>" + E(foPkRoleLbl(p).toUpperCase()) + "</div>" +
      "<div class='fo-sqx-rnat'>" + flag + "<span>" + E(p.nat || "") + "</span></div></div>" +
      "<div class='fo-sqx-rovr'><i>OVR</i><b>" + foPkOvr(p) + "</b></div></div>" +
      "<div class='fo-sqx-sec'><span class='fo-sqx-lbl'>Form <em>(last 5)</em></span><div class='fo-sqx-pips'>" + last5.map(pip).join("") + "</div></div>" +
      "<div class='fo-sqx-sec'><span class='fo-sqx-lbl'>Stamina</span><div class='fo-sqx-stam'><u><b style='width:" + en.pct + "%'></b></u><span>" + en.pct + "%</span></div></div>" +
      "<div class='fo-sqx-sec'><span class='fo-sqx-lbl'>Season stats</span><div class='fo-sqx-stats'>" +
      "<div><i>RUNS</i><b>" + (tot.runs || 0) + "</b></div><div><i>AVG</i><b>" + avg + "</b></div><div><i>HS</i><b>" + (tot.hs || 0) + "</b></div></div></div>" +
      "<div class='fo-sqx-sec fo-sqx-mile'><span class='fo-sqx-lbl'>Next milestone</span>" +
      "<div class='fo-sqx-milerow'><span class='star'>&#9733;</span><div><b>" + away + " away from</b><i>" + mileLbl + "</i></div></div>" +
      "<div class='fo-sqx-mbar'><u><b style='width:" + milePct + "%'></b></u><span>" + mileHave + " / " + mileTarget + "</span></div></div>" +
      "<div class='fo-sqx-cta'><button type='button' class='fo-sqx-viewp'>View player &rsaquo;</button>" +
      (p.__y ? "<button type='button' class='fo-sqx-promote'>Promote to senior +</button>"
             : "<button type='button' class='fo-sqx-xi'>" + (inXi ? "&#10003; In XI &middot; remove" : "Add to XI +") + "</button>") +
      "</div>";
  }

  window.pgSquad = function () {
    try {
      foSqxCss();
      var t = userTeam();
      (t.players || []).forEach(foEnsureTraining); (t.youth || []).forEach(foEnsureTraining);
      window.squadView = window.squadView || {};
      var sv = window.squadView;
      sv.tab = sv.tab || "xi"; sv.sortK = sv.sortK || "OVR"; sv.rarity = sv.rarity || "all";
      var seniors = (t.players || []).map(function (p) { return Object.assign({}, p); });
      var youths = (t.youth || []).map(function (p) { return Object.assign({ __y: true }, p); });
      var all = seniors.concat(youths);
      var byName = {}; all.forEach(function (p) { byName[p.name] = p; });

      // the XI: a persisted selection defaulting to the top 11 by OVR
      if (!sv.xi) sv.xi = seniors.slice().sort(function (a, b) { return foPkOvr(b) - foPkOvr(a); }).slice(0, 11).map(function (p) { return p.name; });
      sv.xi = sv.xi.filter(function (n) { return byName[n] && !byName[n].__y; });
      var xiSet = {}; sv.xi.forEach(function (n) { xiSet[n] = 1; });

      var rarityOf = function (p) { var o = foPkOvr(p); return o >= 80 ? "elite" : o >= 72 ? "rare" : o >= 64 ? "uncommon" : "common"; };
      var enAvg = seniors.length ? Math.round(seniors.reduce(function (s, p) { return s + foEnergyOf(p).pct; }, 0) / seniors.length) : 0;

      // filter by tab
      var pool;
      if (sv.tab === "xi") pool = seniors.filter(function (p) { return xiSet[p.name]; });
      else if (sv.tab === "youth") pool = youths;
      else if (sv.tab === "bat") pool = seniors.filter(function (p) { var c = foSqClass(p); return c === "bat" || c === "ar"; });
      else if (sv.tab === "bowl") pool = seniors.filter(function (p) { var c = foSqClass(p); return c === "bowl" || c === "ar"; });
      else if (sv.tab === "keep") pool = seniors.filter(function (p) { return foSqClass(p) === "wk"; });
      else pool = seniors;
      // rarity / role sub-filter (bottom bar)
      if (["elite", "rare", "uncommon", "common"].indexOf(sv.rarity) >= 0) pool = pool.filter(function (p) { return rarityOf(p) === sv.rarity; });
      else if (["bat", "bowl", "wk", "ar"].indexOf(sv.rarity) >= 0) pool = pool.filter(function (p) { return foSqClass(p) === sv.rarity; });
      else if (sv.rarity === "spin") pool = pool.filter(function (p) { return /spin|wrist|orthodox|legbreak|offbreak|slow/i.test(p.bowlTypeFull || p.bowlType || ""); });
      else if (sv.rarity === "fast") pool = pool.filter(function (p) { return /fast|pace|seam|medium/i.test(p.bowlTypeFull || p.bowlType || ""); });

      var sf = {
        OVR: function (p) { return -foPkOvr(p); }, BAT: function (p) { return -aggBat(p); },
        BOWL: function (p) { return -(p.bowlType ? aggBowl(p) : -1); }, AGE: function (p) { return p.age || 0; },
        FORM: function (p) { return -(p.formIx == null ? 3 : p.formIx); }
      }[sv.sortK] || function (p) { return -foPkOvr(p); };
      pool = pool.slice().sort(function (a, b) { var x = sf(a), y = sf(b); return x < y ? -1 : x > y ? 1 : 0; });

      if (!sv.sel || !byName[sv.sel] || pool.indexOf(byName[sv.sel]) < 0) sv.sel = pool.length ? pool[0].name : (seniors[0] && seniors[0].name);
      var sel = sv.sel ? byName[sv.sel] : null;

      // squad balance from the XI
      var bal = { bat: 0, bowl: 0, ar: 0, wk: 0 };
      sv.xi.forEach(function (n) { var c = foSqClass(byName[n]); bal[c] = (bal[c] || 0) + 1; });

      var cards = pool.map(function (p) {
        var hc = foHoloCardHTML(p, t.name);   // the collectible phc card, tier + role colours
        return "<div class='fo-sqx-card ph-" + hc.tier + (p.name === sv.sel ? " sel" : "") + (xiSet[p.name] ? " inxi" : "") +
          "' data-n='" + E(p.name) + "' style='--tc:" + hc.ac[0] + ";--tcD:" + hc.ac[1] + "'>" + hc.html + "</div>";
      }).join("") || "<div class='fo-sqx-empty'>No players in this view.</div>";

      var tabs = [["xi", "XI"], ["bat", "BAT"], ["bowl", "BOWL"], ["keep", "KEEP"], ["youth", "YOUTH"]].map(function (tb) {
        return "<button class='fo-sqx-tab" + (sv.tab === tb[0] ? " on" : "") + "' data-tab='" + tb[0] + "'>" + tb[1] + "</button>";
      }).join("");
      var sortSel = "<div class='fo-sqx-sort'>SORT: <select id='fo-sqx-sort'>" + ["OVR", "BAT", "BOWL", "AGE", "FORM"].map(function (o) { return "<option" + (sv.sortK === o ? " selected" : "") + ">" + o + "</option>"; }).join("") + "</select></div>";
      var rar = [["all", "ALL"], ["elite", "ELITE"], ["rare", "RARE"], ["uncommon", "UNCOMMON"], ["common", "COMMON"], ["bat", "BATTER"], ["bowl", "BOWLER"], ["wk", "KEEPER"], ["ar", "ALL-ROUNDER"], ["spin", "SPINNER"], ["fast", "FAST"]].map(function (r9) {
        return "<button class='fo-sqx-rar" + (sv.rarity === r9[0] ? " on" : "") + "' data-r='" + r9[0] + "'>" + r9[1] + "</button>";
      }).join("");
      var balHtml = "<div class='fo-sqx-bal'><span class='lbl'>SQUAD BALANCE</span><b>" + (bal.bat + bal.ar) + " BAT</b><i>&middot;</i><b>" + (bal.bowl + bal.ar) + " BOWL</b><i>&middot;</i><b>" + (bal.wk || 0) + " KEEP</b></div>";

      var page = document.getElementById("page"); if (!page) return;
      document.body.classList.add("fo-sqx-on");
      // set the squad over the player's own nation map, so it belongs to the same world as the league
      var sqxNation = "eng"; try { if (typeof foLgNation === "function") sqxNation = foLgNation() || "eng"; } catch (eNat) {}
      var sqxBg = FO_ART + "circuit/" + sqxNation + ".webp";
      page.innerHTML =
        "<div class='fo-sqx'><div class='fo-sqx-bg' style='background-image:url(" + sqxBg + ")' onerror=\"\"></div><div class='fo-sqx-veil'></div><div class='fo-sqx-atmo'></div><div class='fo-sqx-in'>" +
        "<header class='fo-sqx-hd'>" +
        "<div class='fo-sqx-title'><h1>Your Squad</h1><div class='fo-sqx-sub'>" + seniors.length + " players <i>&middot;</i> " + sv.xi.length + " selected</div></div>" +
        "<div class='fo-sqx-tabs'>" + tabs + "</div>" + sortSel +
        "</header>" +
        "<div class='fo-sqx-body'>" +
        "<button type='button' class='fo-sqx-arrow prev' aria-label='Previous player'>&#8249;</button>" +
        "<div class='fo-sqx-gallery'>" + cards + "</div>" +
        "<button type='button' class='fo-sqx-arrow next' aria-label='Next player'>&#8250;</button>" +
        "</div>" +
        "<div class='fo-sqx-count' id='fo-sqx-count'></div>" +
        "<footer class='fo-sqx-foot'>" + balHtml + "</footer>" +
        "</div></div>";

      page.querySelectorAll(".fo-sqx-tab").forEach(function (b) { b.addEventListener("click", function () { sv.tab = b.getAttribute("data-tab"); pgSquad(); }); });
      var so = page.querySelector("#fo-sqx-sort"); if (so) so.addEventListener("change", function () { sv.sortK = so.value; pgSquad(); });
      // arrow carousel: step the focused (large) card left/right through the rail
      var order = [].slice.call(page.querySelectorAll(".fo-sqx-card[data-n]")).map(function (c) { return c.getAttribute("data-n"); });
      (function () { var ce = page.querySelector("#fo-sqx-count"); if (ce) { var ci = order.indexOf(sv.sel) + 1; ce.innerHTML = order.length ? "<b>" + ci + "</b> <s>/</s> " + order.length + " <em>&middot; swipe or tap arrows</em>" : ""; } })();
      var move = function (d) { var i = order.indexOf(sv.sel); if (i < 0) i = 0; var j = Math.max(0, Math.min(order.length - 1, i + d)); if (order[j] && order[j] !== sv.sel) { sv.sel = order[j]; pgSquad(); } };
      var pv = page.querySelector(".fo-sqx-arrow.prev"); if (pv) pv.addEventListener("click", function () { move(-1); });
      var nx = page.querySelector(".fo-sqx-arrow.next"); if (nx) nx.addEventListener("click", function () { move(1); });
      // tap a side card to bring it to focus; tap the focused card to open its page
      page.querySelectorAll(".fo-sqx-card[data-n]").forEach(function (c) {
        c.addEventListener("click", function () {
          var n = c.getAttribute("data-n");
          if (n === sv.sel) location.hash = "#/player?n=" + encodeURIComponent(n);
          else { sv.sel = n; pgSquad(); }
        });
      });
      // centre the focused card in the rail (no page scroll)
      (function () { try { var g = page.querySelector(".fo-sqx-gallery"), s2 = page.querySelector(".fo-sqx-card.sel"); if (g && s2) { var gr = g.getBoundingClientRect(), sr = s2.getBoundingClientRect(); g.scrollLeft += (sr.left + sr.width / 2) - (gr.left + gr.width / 2); } } catch (e) {} })();
    } catch (e) { console.warn("pgSquad", e); }
  };
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

