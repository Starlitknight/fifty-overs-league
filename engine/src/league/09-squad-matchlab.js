  // =========================================================================
  // Squad page rebuild + name hygiene (reviewer pass).
  // The squad page becomes a decision surface: summary strip, structural
  // warnings, dense sortable rows with numbers beside the skill words, and a
  // click-to-expand detail. Training is a read-only badge here · the Training
  // page is the one canonical home for assignments.
  // =========================================================================
  // the three ways to read the squad, in the order the switch shows them
  var SQ_VIEWS = ["roster", "grid", "int"];
  try {
    var foSqCss = document.createElement("style");
    foSqCss.textContent =
      ".fo-sq-strip{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin:10px 0 4px}" +
      ".fo-sq-stat{display:flex;align-items:center;gap:12px;background:#FFFEFC;border:1px solid rgba(28,36,51,.08);border-radius:12px;padding:12px 16px;box-shadow:0 2px 10px rgba(7,22,46,.05)}" +
      ".fo-sqs-ic{flex:0 0 40px;width:40px;height:40px;border-radius:12px;display:flex;align-items:center;justify-content:center}" +
      ".fo-sqs-tx{min-width:0}" +
      ".fo-sqs-ic{background:#F3F1EA}" +
      ".fo-sqs-c1 .fo-sqs-ic{color:#14243A}.fo-sqs-c1 span{color:#4a5e7d}" +
      ".fo-sqs-c2 .fo-sqs-ic{color:#8a5c13}.fo-sqs-c2 span{color:#8a5c13}" +
      ".fo-sqs-c3 .fo-sqs-ic{color:#177A57}.fo-sqs-c3 span{color:#2e6b46}" +
      ".fo-sq-stat span{display:block;font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:#9FB0C6;font-weight:700;margin-bottom:4px}" +
      ".fo-sq-stat b{font-size:21px;color:#14243A}" +
      ".fo-sq-stat i{font-style:normal;font-size:12px;color:#6A6354;margin-left:7px}" +
      ".fo-sq-stat .fo-pos{color:#177A57}.fo-sq-stat .fo-warm{color:#a06a1f}" +
      ".fo-sq-warn{display:flex;align-items:center;gap:12px;background:#F6E3B4;border:1px solid #e8cf8c;border-radius:10px;padding:10px 14px;margin:10px 0;font-size:13px;color:#5a4310;font-weight:600}" +
      ".fo-sq-warn .fo-sq-fix{margin-left:auto;white-space:nowrap;background:#14243A;color:#FFFEFC;border:none;border-radius:8px;padding:7px 13px;font-size:12px;font-weight:700;cursor:pointer}" +
      "html body.ftpskin .fo-sq-warn .fo-sq-fix{background:#14243A !important;color:#FFFEFC !important;border-color:#14243A !important}" +
      ".fo-sq-tools{display:flex;align-items:center;gap:8px;margin:12px 0 8px;flex-wrap:wrap}" +
      ".fo-sq-pill{border:1px solid rgba(28,36,51,.18);background:#FFFEFC;color:#14243A;border-radius:999px;padding:6px 14px;font-size:12.5px;font-weight:700;cursor:pointer}" +
      ".fo-sq-pill.on{background:#14243A;color:#fff;border-color:#14243A}" +
      "html body.ftpskin button.fo-sq-pill{background:#FFFEFC !important;color:#14243A !important;border-color:rgba(28,36,51,.18) !important}" +
      "html body.ftpskin button.fo-sq-pill.on{background:#14243A !important;color:#fff !important;border-color:#14243A !important}" +
      ".fo-sq-sortw{margin-left:auto;font-size:12.5px;color:#6A6354}.fo-sq-sortw select{font-size:12.5px;padding:5px 8px;border-radius:8px}" +
      ".fo-sq-head{display:grid;gap:10px;align-items:center;padding:4px 14px;font-size:10.5px;letter-spacing:.07em;text-transform:uppercase;color:#9FB0C6;font-weight:700}" +
      ".fo-sqr-row{display:grid;gap:10px;align-items:center;padding:9px 14px;background:#FFFEFC;border:1px solid rgba(28,36,51,.07);border-radius:10px;margin:6px 0;cursor:pointer;transition:box-shadow .12s ease}" +
      ".fo-sqr-row:hover{box-shadow:0 3px 14px rgba(7,22,46,.10)}" +
      ".fo-sqr-row,.fo-sq-head{grid-template-columns:minmax(200px,1.5fr) 58px 100px minmax(140px,1fr) minmax(140px,1fr) 46px 92px 16px}" +
      ".fo-sq-warnrow{background:#FBF0D8;border-color:#e8cf8c}" +
      ".fo-sq-nm b{font-size:14px;color:#14243A}.fo-sq-nm a{color:#14243A !important;text-decoration:none;font-weight:800}" +
      "#page .fo-sq-nm a{color:#14243A !important}" +
      ".fo-sq-sub{font-size:11.5px;color:#7a8494;margin-top:1px}" +
      ".fo-sq-talent{display:inline-block;background:#EEE8FA;color:#5b4a91;border-radius:7px;padding:1px 7px;font-size:10.5px;font-weight:700;margin-left:6px;vertical-align:1px}" +
      ".fo-sq-t-warn{background:#F6E3B4;color:#7a5c13}" +
      ".fo-sq-age{font-size:13.5px;color:#14243A;font-weight:700}.fo-sq-age i{font-style:normal;color:#9FB0C6;font-weight:400;margin-left:3px}" +
      ".fo-sq-age .up{color:#177A57}.fo-sq-age .dn{color:#b3402a}" +
      ".fo-fb{display:inline-block;border-radius:999px;padding:3px 11px;font-size:11.5px;font-weight:700}" +
      ".fo-fb-lo{background:#F3D8D3;color:#8a2f1d}.fo-fb-sh{background:#F6E3B4;color:#7a5c13}.fo-fb-md{background:#E8EAEE;color:#6A6354}.fo-fb-hi{background:#D8EADF;color:#1c5537}" +
      ".fo-sq-skbar{height:7px;border-radius:4px;background:#E8EAEE;overflow:hidden;margin-bottom:3px}.fo-sq-skbar i{display:block;height:100%;border-radius:4px}" +
      ".fo-sq-sknum{font-size:11.5px;color:#6A6354}.fo-sq-sknum b{font-size:12px;color:#14243A}" +
      ".fo-sq-nil .fo-sq-skbar i{background:#c9ced8}.fo-sq-nil .fo-sq-sknum{color:#a7aeba}" +
      ".fo-sq-ovr{font-size:17px;font-weight:800;color:#14243A;text-align:right}" +
      ".fo-sq-wage{text-align:right;font-size:13px;font-weight:700;color:#14243A}.fo-sq-wage i{display:block;font-style:normal;font-size:10.5px;color:#9FB0C6;font-weight:400}" +
      ".fo-sq-caret{color:#9FB0C6;font-size:11px;text-align:right}" +
      ".fo-sq-detail{background:#FBFAF7;border:1px solid rgba(28,36,51,.08);border-top:none;border-radius:0 0 10px 10px;margin:-7px 0 6px;padding:14px 16px}" +
      ".fo-sq-dcols{display:grid;grid-template-columns:repeat(3,1fr);gap:8px 26px}" +
      ".fo-sq-dh{font-size:10.5px;letter-spacing:.07em;text-transform:uppercase;color:#9FB0C6;font-weight:800;margin:4px 0 5px}" +
      ".fo-sq-dline{display:flex;align-items:center;gap:8px;font-size:12px;color:#3a4353;margin:3px 0}" +
      ".fo-sq-dline>span:first-child{flex:0 0 92px;color:#6A6354}" +
      ".fo-sq-dbar{flex:1;height:6px;border-radius:3px;background:#E8EAEE;overflow:hidden}.fo-sq-dbar i{display:block;height:100%;border-radius:3px}" +
      ".fo-sq-dline b{flex:0 0 22px;text-align:right;color:#14243A}.fo-sq-dline em{flex:0 0 92px;font-style:normal;color:#7a8494;font-size:11.5px}" +
      ".fo-sq-dfoot{display:flex;flex-wrap:wrap;gap:8px 18px;align-items:center;margin-top:10px;padding-top:10px;border-top:1px dashed rgba(28,36,51,.12);font-size:12px;color:#6A6354}" +
      ".fo-sq-dfoot b{color:#14243A}" +
      ".fo-sq-train{background:#E4EEF6;color:#1f4e6b;border-radius:8px;padding:3px 10px;font-weight:700}" +
      ".fo-sq-foot{font-size:11.5px;color:#9FB0C6;margin:8px 2px}" +
      ".fo-sq-tired{display:inline-block;background:#F3D8D3;color:#8a2f1d;border-radius:7px;padding:1px 7px;font-size:10px;font-weight:800;margin-left:6px;vertical-align:1px}" +
      ".fo-sq-enb-m{display:inline-block;width:62px;margin-left:8px;vertical-align:2px}" +
    ".fo-sq-enb{display:block;width:54px;height:4px;border-radius:2px;background:#E8EAEE;overflow:hidden;margin-top:5px}" +
      ".fo-sq-enb i{display:block;height:100%;border-radius:2px}" +
      ".fo-sq-mfx{display:none}" +
      ".fo-sq-mfx b{font-size:inherit;font-weight:800}" +
      ".fo-mfx-lo{color:#b3402a}.fo-mfx-sh{color:#b07f13}.fo-mfx-md{color:#6A6354}.fo-mfx-hi{color:#177A57}" +
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
      ".fo-sq-mfx{grid-column:1/-1;display:flex;gap:16px;margin-top:2px;padding-top:5px;border-top:1px dashed rgba(28,36,51,.10);font-size:10px;letter-spacing:.05em;text-transform:uppercase;font-weight:800}" +
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
  // THE MASTHEAD IS ONE MASTHEAD. Roster, Grid and Int are three lights on in
  // one room, not three pages, so they wear the same gilt eyebrow and the
  // same heavy uppercase title. Written once here because it was written
  // twice before and the two copies said different things.
  function foSqEyebrow(sv) {
    var eb = "Fifty Overs";
    return eb + " &middot; " + (sv.view === "int" ? "the analyst&#39;s read"
      : sv.who === "yth" ? "the academy" : sv.who === "all" ? "every man on the books" : "the playing staff");
  }
  function foSqClass(p) {
    if (p.role === "wicketkeeper" || p.keeper) return "wk";
    if (p.role === "allRounder") return "ar";
    if (FO_BOWLROLES[p.role]) return "bowl";
    return "bat";
  }
  function foSqSkillCell(v, muted, label) {
    v = Math.round(v);
    var col = v >= 75 ? "#16A34A" : v >= 50 ? "#4DA6A2" : v >= 30 ? "#C08A2E" : "#B23230";
    if (muted || v < 12) {
      return "<div class='fo-sq-skill fo-sq-nil'><div class='fo-sq-skbar'><i style='width:" + Math.max(2, Math.min(100, v)) + "%'></i></div><div class='fo-sq-sknum'>" + v + " · –</div></div>";
    }
    return "<div class='fo-sq-skill' title='" + label + ": " + word(v) + " · rank " + (wIx(v) + 1) + " of 16'><div class='fo-sq-skbar'><i style='width:" + Math.min(100, v) + "%;background:" + col + "'></i></div><div class='fo-sq-sknum'><b>" + v + "</b><span class='fo-sq-skw'> · " + word(v) + "</span></div></div>";
  }
  function foSqDetail(p, isYouth) {
    // the standard seven-skill read-out (the draft card's own bars), not the
    // engine's advanced per-matchup lines - those live on the full profile
    var bars = (typeof foSkillBars === "function") ? foSkillBars(p) : "";
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
      "</div>";
    return "<div class='fo-sq-detail'>" + bars + foot + "</div>";
  }
  // youth contracts: signed into the world when a world club holds the seat
  // (the academy prices the shirt and the umpire keeps the books); the local
  // game's own promotion stands in everywhere else
  // a world seat is held: the live claim when the status has landed, the
  // stored one in the seconds before it does - either way the boys' shirts
  // are the world's to write
  function foSqWorld() {
    try { if (window.__foWorldClaim) return true; } catch (e) {}
    try { return !!localStorage.getItem("fo_world_claim"); } catch (e2) { return false; }
  }
  // el is the button that was pressed: the contract question opens where it
  // stands rather than in a browser dialog over the squad
  function foSqYouthAct(name, action, after, el) {
    try {
      if (window.__foColtAction && window.__foColtAction(name, action, after, el)) return;
    } catch (eW) {}
    if (action === "promote") { try { promoteYouth(App.teamIx, name); } catch (eP) {} after(); return; }
    var run = function () { after(); };
    if (window.foDecide && el) {
      window.foDecide(el, { q: "Let " + name + " go?", note: "He leaves the club for good.",
        ok: "Let him go", cancel: "Keep him", danger: true, onYes: run });
      return;
    }
    run();
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
    // "Grafter", not "Anchor": Anchor is a TALENT, and a derived read must
    // never wear a talent's name or the two become the same thing on the page
    if (te >= 68 && te >= pw) return "Grafter";
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
  // printed. It was tuned for the dark park view, where the top of the scale
  // was pale gold and pale mint - which on the daylight roster and grid made
  // the BEST numbers the hardest to read, exactly backwards. Both surviving
  // views are paper, so the ramp is ink: brick for the poor end, burnt orange
  // through a neutral middle, into a deep green a good number earns. Same
  // thresholds, so a 57 still ranks where it always did.
  var FO_SQ_RAMP = [[40, [178, 50, 48]], [52, [193, 104, 44]], [62, [138, 130, 114]], [72, [34, 99, 95]], [82, [23, 122, 87]], [92, [19, 106, 75]]];
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
  // ===========================================================================
  //  THE GRID — the whole club on one screen, sortable on any column.
  //
  //  The roster reads the squad as people: a face, a role, one overall number.
  //  That is the right first view and it stays the default. But a manager
  //  deciding who opens on a green pitch, or which of two seamers to leave out,
  //  is not browsing - he is comparing, and comparing wants a table.
  //
  //  ONE SCREEN, NOT A SPREADSHEET. This deliberately does NOT print the
  //  engine's twenty-odd raw attributes. That table was three screens wide and
  //  nobody could read across it. What is here is the ten figures a selection
  //  decision actually turns on - age, batting, bowling, technique, power,
  //  fielding, experience, form, wage and the overall - narrow enough that the
  //  whole club fits without scrolling anywhere. The deep skill breakdown
  //  belongs to the man: his name opens his page, and it is all there.
  //
  //  NUMBERS AND WORDS. The engine thinks in 0-100 and the game speaks in the
  //  ladder (ordinary ▸ capable ▸ expert ▸ elite). The grid prints the number,
  //  colours it on the same ramp as every other rating in the game, and names
  //  it in the tooltip - and Words swaps the two over for anyone who reads the
  //  ladder faster than the digits.
  //
  //  HONEST BLANKS. A batter has no bowling figure worth reading. That cell is
  //  struck through rather than filled with a small number that would rank him.
  //
  //  Sorting is a pure function of the column and direction, so the same click
  //  gives the same order on every device.
  // ===========================================================================
  // form 0-6 (engine FORMW ladder) as a glance-able trend mark: arrows above
  // and below "steady", coloured off the same ramp as every rating on the page
  function foSqFormGlyph(p) {
    var ix = p.formIx == null ? 3 : p.formIx;
    var w = (typeof FORMW !== "undefined" && FORMW[ix]) || "steady";
    var g = ix >= 5 ? "&#9650;" : ix === 4 ? "&#9652;" : ix === 3 ? "&#8212;" : ix === 2 ? "&#9662;" : "&#9660;";
    var c = ix >= 5 ? "#1E8C63" : ix === 4 ? "#4F9A76" : ix === 3 ? "#8A8272" : ix === 2 ? "#B5722F" : "#C0432C";
    return "<span class='fo-sqt-frm' title='Form: " + E(w) + "'><b style='color:" + c + "'>" + g + "</b><span class='w' style='color:" + c + "'>" + E(w) + "</span></span>";
  }
  // ---------------------------------------------------------------------------
  //  HOW OLD IS HE, TO THE DAY
  //
  //  A whole number was too blunt: two men both "30" can be nine months apart,
  //  and a colt watching his birthday come is worth something to look at. So an
  //  age reads 24.17 - twenty-four years and seventeen days - where a year in
  //  this world is thirty days long.
  //
  //  The day is the day of the SEASON, and a season is thirty days long - so the
  //  day ticks once per real day, reads 1 on the season's opening morning and 30
  //  on its last, and rolls back to 1 at the rollover. Which is the same moment
  //  the umpire puts a year on everybody. So 20.30 becomes 21.01 exactly, and
  //  the year is still his to give, never the client's to invent.
  //
  //  Nothing is stored: it is a pure function of the world clock, the same on
  //  every device, with no drift between a manager who logs in daily and one who
  //  comes back in a fortnight.
  // ---------------------------------------------------------------------------
  // ONE YEAR IS ONE SEASON, TO THE DAY. The year's length is not this
  // module's to declare: the planet's CYCLE is the law (42 world days at
  // present), read live so the calendar can never drift from the world it
  // describes. The old hard-coded 30 made a year shorter than the season -
  // day 31 of the summer read as day 1 of a new one nobody had started.
  function foAgeDays() {
    try { var c = window.__foPlanet && window.__foPlanet.CYCLE; if (c >= 1) return c | 0; } catch (e) {}
    return 42;
  }
  function foSqSeasonDay() {
    var L = foAgeDays();
    try {
      var pl = window.__foPlanet;
      if (pl && pl.phaseOf) {
        var di = pl.phaseOf(Date.now()).di;
        if (di >= 0) return (di % L) + 1;
      }
      if (pl && pl.dayIx) return (((pl.dayIx(Date.now()) % L) + L) % L) + 1;
    } catch (e) {}
    var d0 = Math.floor((Date.now() - Date.UTC(2026, 6, 28)) / 86400000);
    return (((d0 % L) + L) % L) + 1;
  }
  // EVERY MAN HAS HIS OWN BIRTHDAY. The day part used to be the day of the
  // SEASON, which made it the same number for everybody: a whole dressing room
  // reading 29y 1d, 37y 1d, 24y 1d, all ticking over together. That is a
  // calendar, not a set of birthdays.
  //
  // A cricketer's birthday is now a day of the season of his own, scattered
  // across the thirty by a hash of his name. Nothing is stored: it is the same
  // day on every device and in every session, for as long as he is called what
  // he is called, and it costs no bytes in the save or the snapshot.
  function foBirthDay(p) {
    return (foHash32("bday|" + ((p && p.name) || "")) % foAgeDays()) + 1;   // 1..cycle
  }
  function foAgeParts(p) {
    var L = foAgeDays();
    var y = Math.max(0, p.age | 0), bd = foBirthDay(p), sd = foSqSeasonDay();
    // days since HIS last birthday, wrapping the season boundary: a man born on
    // day 40 is four days past it on day 2, not thirty-eight short of it
    var d = ((sd - bd) % L + L) % L;
    return { y: y, d: d, bd: bd, total: y * L + d };
  }
  function foAgeText(p) {
    var a = foAgeParts(p);
    return a.y + "." + (a.d < 10 ? "0" : "") + a.d;
  }
  function foAgeLong(p) {
    var a = foAgeParts(p);
    return a.y + " years, " + a.d + (a.d === 1 ? " day" : " days") +
      " \u2014 his birthday falls on day " + a.bd + " of the season, and a year here is one season, " +
      foAgeDays() + " days";
  }
  try { window.__foAge = { parts: foAgeParts, text: foAgeText, long: foAgeLong, birthday: foBirthDay }; } catch (eAg) {}

  function foSqLad(v, k) {
    try {
      if (k === "exp" && typeof EXPLAD !== "undefined") return EXPLAD[Math.max(0, Math.min(EXPLAD.length - 1, Math.floor(v / (100 / EXPLAD.length))))];
      return word(v);
    } catch (e) { return ""; }
  }
  // the columns, in reading order. num: right-aligned rating. agg: a headline
  // figure, tinted so the eye finds it. live: false means the number does not
  // apply to this man and the cell is struck through instead.
  var FO_SQ_COLS = [
    { k: "pos", l: "#", s: "#", tip: "Batting position in the XI", num: 1,
      v: function (p, x) { return x.xiIx(p) < 0 ? 99 : x.xiIx(p); } },
    { k: "name", l: "Player", s: "Player", tip: "Click any row for his full skill breakdown",
      v: function (p) { return p.name; } },
    { k: "role", l: "Role", s: "Role", tip: "How the club uses him",
      v: function (p) { return foSqClass(p); } },
    { k: "nat", l: "Nat", s: "Nat", tip: "Where he is from - and who can pick him for a country",
      v: function (p) { return String(p.nat || "zzz"); } },
    { k: "age", l: "Age", s: "Age", tip: "Years and days - a year here is 30 days, and a day passes every real day", num: 1,
      v: function (p) { return foAgeParts(p).total; } },
    { k: "bat", l: "Bat", s: "Bat", tip: "Batting: vs pace, vs spin, rotation, temperament, power", num: 1, agg: 1,
      v: function (p) { return Math.round(aggBat(p)); } },
    { k: "bowl", l: "Bowl", s: "Bowl", tip: "Bowling: threat, control, discipline, movement, variety, stamina", num: 1, agg: 1,
      v: function (p) { return p.bowlType ? Math.round(aggBowl(p)) : -1; } },
    { k: "tech", l: "Tech", s: "Tech", tip: "Technique: vs pace, vs spin and temperament - the batting core", num: 1,
      v: function (p) { return Math.round(aggTech(p)); } },
    { k: "power", l: "Power", s: "Pwr", tip: "Six-hitting muscle", num: 1,
      v: function (p) { try { return Math.round((p.skills || {}).power || 0); } catch (e) { return 0; } } },
    { k: "field", l: "Field", s: "Fld", tip: "Fielding: ground work and catching", num: 1,
      v: function (p) { return Math.round(aggField(p)); } },
    { k: "keep", l: "WK", s: "WK", tip: "Wicketkeeping: glovework, stumping and catching", num: 1, nil: "Does not keep",
      v: function (p) { return (p.keeper || aggKeep(p) >= 20) ? Math.round(aggKeep(p)) : -1; } },
    { k: "exp", l: "Exp", s: "Exp", tip: "Experience - steadies him in the death overs and tight chases", num: 1,
      v: function (p) { return Math.round(p.exp || 0); } },
    { k: "form", l: "Form", s: "Form", tip: "Current form: abysmal to excellent, worth up to 6% either way", num: 1,
      v: function (p) { return p.formIx == null ? 3 : p.formIx; } },
    { k: "fit", l: "Fitness", s: "Fit", tip: "Match fitness - the energy left in his legs. Tired men bowl slower, misfield more, and train at half pace; sort on this before naming the XI", num: 1,
      v: function (p) { try { return foEnergyOf(p).pct; } catch (e) { return 100; } } },
    { k: "wage", l: "Wage", s: "Wage", tip: "What he costs the club a week", num: 1,
      v: function (p) { return Math.round(p.wage || 0); } },
    { k: "ovr", l: "OVR", s: "OVR", tip: "Overall rating - the one number the whole game sorts by", num: 1, agg: 1,
      v: function (p) { return foPkOvr(p); } }
  ];
  function foSqCol(k) {
    for (var i = 0; i < FO_SQ_COLS.length; i++) if (FO_SQ_COLS[i].k === k) return FO_SQ_COLS[i];
    return null;
  }
  function foSqGrid(list, sv, xiIx) {
    var ctx = { xiIx: xiIx };
    var cols = FO_SQ_COLS;
    // the role filter: a keeper (or any discipline) can be read on his own
    var role = ["bat", "ar", "wk", "bowl"].indexOf(sv.role) >= 0 ? sv.role : "all";
    if (role !== "all") list = list.filter(function (p) { return foSqClass(p) === role; });
    var col = foSqCol(sv.sortK) || foSqCol("ovr");
    var dir = sv.sortDir === 1 ? 1 : -1;
    var rows = list.slice().sort(function (a, b) {
      var x = col.v(a, ctx), y = col.v(b, ctx);
      if (typeof x === "string") return String(x).localeCompare(String(y)) * dir;
      if (x === y) return String(a.name).localeCompare(String(b.name));
      return (x - y) * dir;
    });

    var head = cols.map(function (c) {
      var on = c.k === sv.sortK;
      return "<th class='fo-sqg-h" + (on ? " on" : "") + (c.num ? " n" : "") + (c.agg ? " agg" : "") + " c-" + c.k + "'" +
        " data-sort='" + c.k + "' title='" + E(c.tip || c.l) + "'" +
        " aria-sort='" + (on ? (dir === 1 ? "ascending" : "descending") : "none") + "'>" +
        "<span class='lg'>" + E(c.l) + "</span><span class='sm'>" + E(c.s || c.l) + "</span>" +
        "<i>" + (on ? (dir === 1 ? "&#9650;" : "&#9660;") : "") + "</i></th>";
    }).join("");

    var cell = function (c, p) {
      var v = c.v(p, ctx);
      if (c.k === "name") {
        return "<td class='c-name'><span class='fo-sqg-nm'>" + E(p.name) + foSqStar(p) + "</span>" +
          (p.__y ? "<em class='fo-sqg-y' title='Youth player'>U20</em>" : "") +
          "<i class='fo-sqg-go' aria-hidden='true'>&#8250;</i></td>";
      }
      if (c.k === "pos") {
        var ix = xiIx(p);
        return "<td class='n c-pos'>" + (ix >= 0 ? "<b>" + (ix + 1) + "</b>" : "<span class='fo-sqg-out' title='Not in the XI'>&ndash;</span>") + "</td>";
      }
      if (c.k === "role") {
        var cls = foSqClass(p);
        var lbl = cls === "wk" ? "WK" : cls === "ar" ? "AR" : cls === "bowl" ? "BOWL" : "BAT";
        return "<td class='c-role'><span class='fo-sqg-role " + cls + "'>" + lbl + "</span></td>";
      }
      // the flag says it: a three-letter code beside it is the same fact twice
      if (c.k === "nat") {
        var nat = String(p.nat || ""), flg = "";
        try { flg = FO_ART + "flags/" + ((typeof FO_FLAG_FILE !== "undefined" && FO_FLAG_FILE[foSqNatId(p.nat)]) || foSqNatId(p.nat)) + ".svg"; } catch (eFg) {}
        if (!nat) return "<td class='c-nat'><span class='fo-sqg-nil'>&ndash;</span></td>";
        return "<td class='c-nat' title='" + E(nat) + "'>" +
          (flg ? "<span class='fo-sqg-fl'><img src='" + flg + "' alt='" + E(nat) + "' loading='lazy'" +
            " onerror=\"this.parentNode.outerHTML=&quot;<span class=&#39;fo-sqg-nat&#39;>" + E(nat) + "</span>&quot;\"></span>"
               : "<span class='fo-sqg-nat'>" + E(nat) + "</span>") + "</td>";
      }
      // years and days, in the same words the market and the man's own page
      // use - "34.20" read as a decimal and meant nothing at a glance
      if (c.k === "age") {
        var ag9 = foAgeParts(p);
        return "<td class='n c-age' title='" + E(foAgeLong(p)) + "'>" + ag9.y + "y " + (ag9.d < 10 ? "&#8199;" : "") + ag9.d + "d</td>";
      }
      if (c.k === "wage") return "<td class='n c-wage'>" + (typeof money === "function" ? money(p.wage || 0) : "$" + (p.wage | 0)) + "</td>";
      if (c.k === "form") return "<td class='n c-form'>" + foSqFormGlyph(p) + "</td>";
      // fitness is a gauge, not a rating: the bar drains as the fatigue
      // ladder climbs, and the ladder word is the tooltip
      if (c.k === "fit") {
        var en9 = { pct: 100, raw: "rested", tired: false };
        try { en9 = foEnergyOf(p); } catch (eEn9) {}
        var fc9 = en9.tired ? "#B23230" : en9.pct >= 80 ? "#177A57" : "#8F6A1C";
        return "<td class='n c-fit' title='" + E("Fitness: " + en9.raw + " (" + en9.pct + "%)") + "'>" +
          "<span class='fo-sqg-fit'><i style='width:" + en9.pct + "%;background:" + fc9 + "'></i></span>" +
          "<span class='fo-sqg-v' style='color:" + fc9 + "'>" + en9.pct + "</span></td>";
      }
      if (v < 0) return "<td class='n c-" + c.k + (c.agg ? " agg" : "") + "'><span class='fo-sqg-nil' title='" + E(c.nil || "Does not bowl") + "'>&ndash;</span></td>";
      // the number is the reading; the ladder word it sits on is the tooltip
      return "<td class='n c-" + c.k + (c.agg ? " agg" : "") + "' title='" + E(c.l + ": " + foSqLad(v, c.k) + " (" + v + ")") + "'>" +
        "<span class='fo-sqg-v' style='color:" + foSqQCol(v) + "'>" + v + "</span></td>";
    };

    var body = rows.map(function (p) {
      // the row's own namespaced class - a bare "yth" is the kind of generic
      // name another page's chip will happily claim
      return "<tr class='fo-sqg-r" + (xiIx(p) >= 0 ? " inxi" : "") + (p.__y ? " fo-sqg-yth" : "") + "'" +
        " data-n='" + E(p.name) + "' tabindex='0' role='link'" +
        " aria-label='Open the full profile for " + E(p.name) + "'>" +
        cols.map(function (c) { return cell(c, p); }).join("") + "</tr>";
    }).join("");

    // one short question, one list
    var who = sv.who || "sen";
    var controls = "<div class='fo-sqg-ctl'><label class='fo-sqg-pick'><span>Show</span><select data-show>" +
      [["sen", "Seniors"], ["yth", "Youth"], ["all", "Everyone"]].map(function (o) {
        return "<option value='" + o[0] + "'" + (o[0] === who ? " selected" : "") + ">" + E(o[1]) + "</option>";
      }).join("") + "</select></label>" +
      "<label class='fo-sqg-pick'><span>Role</span><select data-role>" +
      [["all", "All roles"], ["bat", "Batsmen"], ["ar", "All-rounders"], ["wk", "Wicketkeepers"], ["bowl", "Bowlers"]].map(function (o) {
        return "<option value='" + o[0] + "'" + (o[0] === role ? " selected" : "") + ">" + E(o[1]) + "</option>";
      }).join("") + "</select></label></div>";

    var cap = rows.length ? ""
      : (role !== "all" ? "Nobody in that role here. Try another Role or Show setting."
        : who === "yth" ? "No youth players at the club yet." : "Nobody to show.");

    return "<div class='fo-sqg-outer'>" + controls +
      (cap ? "<p class='fo-sqg-cap'>" + cap + "</p>" : "") +
      "<div class='fo-sqg-wrap'><table class='fo-sqg'>" +
      "<thead><tr>" + head + "</tr></thead>" +
      "<tbody>" + (body || "<tr><td class='fo-sqg-none' colspan='" + cols.length + "'>Nobody to show. Try another Show setting.</td></tr>") + "</tbody>" +
      "</table></div></div>";
  }
  function foSqStars(ovr) {
    var n = Math.max(1, Math.min(5, Math.round(ovr / 20))), s = "";
    for (var i = 1; i <= 5; i++) s += "<span class='" + (i <= n ? "on" : "") + "'>&#9733;</span>";
    return s;
  }

  function foSqxCss() {
    if (document.getElementById("fo-sqx-css")) return;
    var s = document.createElement("style"); s.id = "fo-sqx-css";
    s.textContent = [
      // full-bleed dark stage (widen the app's padded .wrap while mounted)
      "html body.fo-sqx-on .wrap{max-width:none !important;width:100% !important;padding:0 !important;margin:0 !important;background:transparent !important;box-shadow:none !important}",
      "html body.fo-sqx-on #topbar,html body.ftpskin.fo-sqx-on #topbar{position:fixed;top:0;left:0;right:0;z-index:60;background:linear-gradient(180deg,rgba(7,22,46,.9),rgba(7,22,46,.4) 62%,transparent) !important;border-bottom:none !important;box-shadow:none !important}",
      "html body.fo-sqx-on #page{padding-top:0 !important;margin-top:0 !important}",
      "html body.fo-sqx-on #fo-top-status{display:none}",
      "#page .fo-sqx{--gold:#E8B96A;--ink:#070d18;position:relative;min-height:100vh;background:#E9E4D8;color:#1B2432;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}",
      "#page .fo-sqx *{box-sizing:border-box}",
      "#page .fo-sqx button{font-family:Inter,sans-serif}",
      // ---- the two-column stage: the park on the left, the man on the right ----
      ".fo-sqx-in{position:relative;z-index:1;display:grid;grid-template-columns:minmax(0,1fr) 400px;gap:18px;align-items:start;max-width:1720px;margin:0 auto;padding:64px 20px 22px}",
      // ---- the park ----
      ".fo-sqx-park{position:relative;border-radius:16px;overflow:hidden;isolation:isolate}",
      ".fo-sqx-bg{position:absolute;inset:0;background-size:cover;background-position:center 40%;z-index:0;transform:scale(1.04)}",
      // the ground art is a daylight painting - the veil holds the header and
      // footer readable but lets the afternoon through in the middle
      ".fo-sqx-veil{position:absolute;inset:0;z-index:0;background:linear-gradient(180deg,rgba(6,11,20,.16) 0%,transparent 26%,transparent 62%,rgba(5,9,16,.30) 100%)}",
      ".fo-sqx-parkin{position:relative;z-index:1;padding:22px 20px 20px}",
      // masthead over the art
      ".fo-sqx-hd{margin-bottom:14px}",
      ".fo-sqx-hd h1{font-family:Fraunces,Georgia,serif;font-weight:600;letter-spacing:-.015em;font-size:clamp(32px,4.6vw,56px);line-height:1.02;margin:0;color:#fff;text-shadow:0 4px 24px rgba(0,0,0,.6)}",
      ".fo-sqx-tag{font-family:Fraunces,Georgia,serif;font-style:normal;font-size:clamp(14px,1.5vw,19px);color:var(--gold);margin-top:6px;text-shadow:0 2px 12px rgba(0,0,0,.7)}",
      // the field itself
      // the team photograph: standing row behind, seated row in front,
      // the front row overlapping the back the way bodies do on the steps
      ".fo-sqx-field{position:relative;display:flex;flex-direction:column;gap:0;padding:clamp(10px,2vh,22px) 0 clamp(6px,1.4vh,14px);min-height:clamp(340px,50vh,520px);justify-content:flex-end}",
      ".fo-sqx-row{display:flex;justify-content:center;gap:clamp(8px,1.4vw,22px);flex-wrap:nowrap}",
      // every frame in the photograph is the same size - the rows overlap
      // for depth, but no man is printed smaller than another
      ".fo-sqx-row.ph-back{z-index:1}",
      ".fo-sqx-row.ph-back .fo-sqx-man:hover,.fo-sqx-row.ph-back .fo-sqx-man.sel{transform:translateY(-4px)}",
      ".fo-sqx-row.ph-front{z-index:2;margin-top:clamp(-20px,-1.8vh,-9px)}",
      ".fo-sqx-plate{align-self:center;margin-top:clamp(10px,1.8vh,18px);padding:7px 22px;border-radius:4px;text-align:center;background:linear-gradient(180deg,#caa64e,#8f7226 85%);box-shadow:0 2px 8px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,240,200,.55);border:1px solid rgba(60,47,13,.6)}",
      ".fo-sqx-plate b{display:block;font-family:Inter,sans-serif;font-weight:600;font-size:12px;letter-spacing:.24em;text-transform:uppercase;color:#2e2408;text-shadow:0 1px 0 rgba(255,240,200,.4)}",
      ".fo-sqx-plate span{display:block;font-family:Fraunces,Georgia,serif;font-style:normal;font-size:10.5px;color:#4a3a10}",
      // a man on the park
      "html body #page button.fo-sqx-man{position:relative;width:clamp(72px,7.2vw,104px);padding:0 0 6px !important;border:0 !important;border-radius:12px !important;font:inherit !important;cursor:pointer;background:linear-gradient(180deg,rgba(10,18,32,.42),rgba(6,11,20,.9)) !important;outline:1.5px solid rgba(150,180,225,.22);transition:transform .18s cubic-bezier(.2,.7,.2,1),outline-color .18s,box-shadow .18s}",
      "html body #page button.fo-sqx-man:hover{background:linear-gradient(180deg,rgba(14,24,42,.5),rgba(6,11,20,.94)) !important;transform:translateY(-4px);outline-color:rgba(235,194,113,.6);box-shadow:0 12px 26px rgba(0,0,0,.5)}",
      "html body #page button.fo-sqx-man.sel{outline:2px solid var(--gold);box-shadow:0 0 0 4px rgba(235,194,113,.16),0 14px 30px rgba(0,0,0,.55);transform:translateY(-4px)}",
      ".fo-sqx-man .pic{display:block;width:100%;aspect-ratio:1/1;object-fit:cover;object-position:50% 12%;border-radius:11px 11px 0 0;background:#0d1626}",
      ".fo-sqx-man .no{position:absolute;top:5px;left:5px;font-family:Inter,sans-serif;font-weight:700;font-size:11px;line-height:1;color:#0d1526;background:rgba(235,194,113,.95);border-radius:5px;padding:2px 5px}",
      // hot and cold streaks read from the park itself: a small trend mark on
      // the shoulder, and an amber outline on anyone playing on empty legs
      ".fo-sqx-man .frm{position:absolute;top:25px;left:6px;font-size:10px;line-height:1;text-shadow:0 1px 4px rgba(0,0,0,.85)}",
      ".fo-sqx-man .frm.hi{color:#7BD3A6}.fo-sqx-man .frm.lo{color:#e0704f}",
      "html body #page button.fo-sqx-man.wkn{outline-color:rgba(224,164,79,.65)}",
      ".fo-sqx-dfrm{font-style:normal;margin-left:8px}",
      ".fo-sqx-man .nm{display:block;font-family:Inter,sans-serif;font-weight:600;text-transform:uppercase;letter-spacing:.02em;font-size:clamp(9px,.85vw,11.5px);line-height:1.1;color:#f2f6ff;padding:6px 4px 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      ".fo-sqx-man .rl{display:block;font-family:Inter,sans-serif;font-weight:600;text-transform:uppercase;letter-spacing:.12em;font-size:10px;padding-top:2px}",
      ".fo-sqx-man .rl.bat{color:#E8B96A}.fo-sqx-man .rl.ar{color:#4CC38A}.fo-sqx-man .rl.bowl{color:#4DA6A2}.fo-sqx-man .rl.wk{color:#E06A32}",
      ".fo-sqx-man .en{position:absolute;left:5px;right:5px;bottom:22px;height:3px;border-radius:2px;background:rgba(4,9,18,.7);overflow:hidden}",
      ".fo-sqx-man .en i{display:block;height:100%;background:linear-gradient(90deg,#8F6A1C,var(--gold))}",
      ".fo-sqx-man .en.lo i{background:linear-gradient(90deg,#8c2f2f,#DC6A5A)}",
      ".fo-sqx-man.tgt{outline:2px dashed rgba(91,208,166,.9);animation:foSqPulse 1.3s ease-in-out infinite}",
      "@keyframes foSqPulse{0%,100%{box-shadow:0 0 0 0 rgba(91,208,166,.35)}50%{box-shadow:0 0 0 7px rgba(91,208,166,0)}}",
      "@media(prefers-reduced-motion:reduce){.fo-sqx-man.tgt{animation:none}}",
      // ---- park / list switch ----
      ".fo-sqx-views{display:inline-flex;gap:3px;margin-top:12px;padding:3px;border-radius:999px;background:rgba(7,13,24,.6);border:1px solid rgba(126,158,208,.22);backdrop-filter:blur(8px)}",
      "html body #page button.fo-sqx-vb{border:0 !important;border-radius:999px !important;padding:8px 18px !important;cursor:pointer;background:transparent !important;color:#a8b8d4 !important;font:600 11px Inter,sans-serif !important;text-transform:uppercase;letter-spacing:.18em;transition:.15s}",
      "html body #page button.fo-sqx-vb:hover{color:#e7eefb !important;background:rgba(20,32,54,.7) !important}",
      "html body #page button.fo-sqx-vb.on{background:var(--gold) !important;color:#0d1526 !important}",
      // ---- the grid: the squad as a comparison table -------------------------
      // Paper, not glass. The roster established the daylight almanack look for
      // this page and the grid is the same club read a different way, so it
      // keeps the paper, the rule under the label and the ink.
      ".fo-sqg-outer{position:relative;z-index:2;max-width:980px;margin:6px auto 34px}",
      ".fo-sqg-ctl{display:flex;flex-wrap:wrap;align-items:center;gap:8px 14px;margin-bottom:11px}",
      ".fo-sqg-pick{display:inline-flex;align-items:center;gap:7px}",
      ".fo-sqg-pick>span{font-family:Inter,sans-serif;font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:rgba(20,28,40,.42)}",
      "html body #page .fo-sqg-pick select,html body.ftpskin #page .fo-sqg-pick select{-webkit-appearance:none;appearance:none;border:1px solid rgba(20,28,40,.16) !important;border-radius:8px !important;background:#FFFEFC url(\"data:image/svg+xml,%3Csvg xmlns=&#39;http://www.w3.org/2000/svg&#39; viewBox=&#39;0 0 10 6&#39;%3E%3Cpath d=&#39;M1 1l4 4 4-4&#39; fill=&#39;none&#39; stroke=&#39;%231B2432&#39; stroke-width=&#39;1.4&#39; stroke-linecap=&#39;round&#39;/%3E%3C/svg%3E\") no-repeat right 10px center/10px 6px !important;color:#1B2432 !important;font:600 11px Inter,sans-serif !important;letter-spacing:.1em;text-transform:uppercase;padding:7px 28px 7px 11px !important;min-height:32px;cursor:pointer}",
      "html body #page .fo-sqg-pick select:hover{border-color:rgba(217,85,42,.5) !important}",
      "html body #page .fo-sqg-pick select:focus-visible{outline:2px solid #C9571F;outline-offset:1px}",
      ".fo-sqg-cap{margin:0 0 10px;font:400 12.5px/1.5 Fraunces,Georgia,serif;color:rgba(20,28,40,.58)}",
      ".fo-sqg-cap b{font-style:normal;font-weight:600;color:#B44A22}",
      // NO SCROLLBAR OF ITS OWN. A box with its own bar inside a page with
      // another one is two scrollbars for one list. The grid is as tall as the
      // squad and the window scrolls it, the way the rest of the game reads.
      // The header still pins - to the page, under the fixed topbar.
      ".fo-sqg-wrap{position:relative;overflow:visible;background:#FFFEFC;border:1px solid rgba(20,28,40,.11);border-radius:14px;box-shadow:0 10px 30px rgba(30,38,52,.09)}",
      // width:auto, not 100%: a 27-column set must be allowed to be wider than
      // the box and scroll, rather than squeezing every number into 12px on a
      // phone. min-width keeps a narrow set (Fielding) filling the paper.
      // body.ftpskin table{width:100%} outranks a lone class, and a 100%-wide
      // table squeezes 27 columns into a phone. Match its specificity.
      "html body #page table.fo-sqg,html body.ftpskin #page table.fo-sqg{border-collapse:separate;border-spacing:0;width:auto;min-width:100%;table-layout:auto}",
      ".fo-sqg td.n,html body #page th.fo-sqg-h.n{min-width:40px}",
      ".fo-sqg td.c-name,html body #page th.fo-sqg-h.c-name{min-width:150px;width:150px}",
      ".fo-sqg td.c-role{min-width:44px}",
      ".fo-sqg td.c-pos,html body #page th.fo-sqg-h.c-pos{min-width:26px}",
      ".fo-sqg td.c-wage,html body #page th.fo-sqg-h.c-wage{min-width:54px}",
      // the two header bands, both sticky, the group band above the columns
      // the skin styles bare th, so the band needs the same specificity to win
      "html body #page .fo-sqg-bands th,html body.ftpskin #page .fo-sqg-bands th{position:sticky;top:0;z-index:6;height:29px;background:#F4EFE3 !important;border-bottom:1px solid rgba(20,28,40,.1) !important}",
      "html body #page th.fo-sqg-band,html body.ftpskin #page th.fo-sqg-band{padding:7px 10px !important;text-align:left;white-space:nowrap;font:600 11px Inter,sans-serif !important;letter-spacing:.2em;text-transform:uppercase;color:#B44A22 !important;border-left:1px solid rgba(20,28,40,.08) !important}",
      "html body #page th.fo-sqg-band.blank{border-left:0 !important}",
      // A SCOREBOOK HEADING, NOT A SPREADSHEET ONE. Navy ink with the club's
      // gold on it, a burnt-orange rule under the whole band, and the column
      // being sorted lit in gold with the same rule doubled beneath it.
      "html body #page th.fo-sqg-h,html body.ftpskin #page th.fo-sqg-h{position:sticky;top:46px;z-index:5;text-align:left;white-space:nowrap;cursor:pointer;user-select:none;padding:11px 7px !important;background:linear-gradient(180deg,#14243A,#0A1A34) !important;color:#A9BEDD !important;border-bottom:2px solid #C9571F !important;font:600 11px Inter,sans-serif !important;letter-spacing:.13em;text-transform:uppercase;transition:color .14s,background .14s}",
      "html body #page th.fo-sqg-h:first-child{border-top-left-radius:13px}",
      "html body #page th.fo-sqg-h:last-child{border-top-right-radius:13px}",
      "html body #page th.fo-sqg-h:hover{color:#F0D9A6 !important;background:linear-gradient(180deg,#143059,#0D2141) !important}",
      "html body #page th.fo-sqg-h.on{color:#E8B96A !important;background:linear-gradient(180deg,#16345F,#0E2244) !important;box-shadow:inset 0 -4px 0 #C89A2E}",
      "html body #page th.fo-sqg-h.n{text-align:right}",
      "html body #page th.fo-sqg-h.agg{background:linear-gradient(180deg,#123055,#0B1E3C) !important;color:#C6D8F2 !important}",
      "html body #page th.fo-sqg-h.agg.on{color:#E8B96A !important}",
      ".fo-sqg-h i{color:#E8B96A}",
      ".fo-sqg-h i{font-style:normal;font-size:10px;margin-left:4px;vertical-align:2px}",
      ".fo-sqg-h .sm{display:none}",
      // cells
      ".fo-sqg td{padding:0 7px;height:36px;border-bottom:1px solid rgba(20,28,40,.07);font:400 12.5px/1 Inter,sans-serif;color:#1B2432;white-space:nowrap}",
      ".fo-sqg td.n{text-align:right;font-variant-numeric:tabular-nums}",
      ".fo-sqg td.agg{background:rgba(244,239,227,.6)}",
      ".fo-sqg tbody tr:last-child td{border-bottom:0}",
      ".fo-sqg-r:nth-child(even) td{background:rgba(20,28,40,.022)}",
      ".fo-sqg-r:nth-child(even) td.c-name{background:#FCFAF6 !important}",
      ".fo-sqg-r{cursor:pointer}",
      ".fo-sqg-r:hover td,.fo-sqg-r:focus-visible td{background:rgba(201,85,50,.06);outline:none}",
      ".fo-sqg-r:hover td.agg,.fo-sqg-r:focus-visible td.agg{background:rgba(201,85,50,.1)}",
      // the name column is the anchor: pinned left, so a wide set still reads
      ".fo-sqg td.c-name{position:sticky;left:0;z-index:4;background:#FFFEFC !important;box-shadow:1px 0 0 rgba(20,28,40,.1)}",
      "html body #page th.fo-sqg-h.c-name{position:sticky;left:0;z-index:7}",
      ".fo-sqg-r:hover td.c-name,.fo-sqg-r:focus-visible td.c-name{background:#FDF4F0 !important}",
      ".fo-sqg-nm{font-weight:600;color:#1B2432}",
      ".fo-sqg-r.fo-sqg-yth .fo-sqg-nm{color:rgba(20,28,40,.72)}",
      ".fo-sqg-y{display:inline-block;margin-left:6px;font-style:normal;font-family:Inter,sans-serif;font-size:10px;letter-spacing:.1em;padding:1px 5px;border-radius:4px;vertical-align:1px;background:rgba(20,28,40,.08);color:rgba(20,28,40,.6)}",
      ".fo-sqg-go{float:right;font-style:normal;color:rgba(20,28,40,.28);opacity:0;transition:opacity .14s,transform .14s;padding-left:8px}",
      ".fo-sqg-r:hover .fo-sqg-go,.fo-sqg-r:focus-visible .fo-sqg-go{opacity:1;transform:translateX(2px);color:#C9571F}",
      // the XI carries its batting number in gold; everyone else a quiet dash
      ".fo-sqg-r.inxi td.c-pos b{font-family:Inter,sans-serif;font-weight:700;font-size:12.5px;color:#B08409}",
      ".fo-sqg-r.inxi td.c-name{box-shadow:inset 3px 0 0 #C89A2E,1px 0 0 rgba(20,28,40,.1)}",
      ".fo-sqg-out,.fo-sqg-nil{color:rgba(20,28,40,.26)}",
      // a number the man cannot own is struck through, not filled with a lie
      ".fo-sqg-nil{text-decoration:line-through;text-decoration-thickness:1px}",
      ".fo-sqg-role{font-family:Inter,sans-serif;font-weight:600;text-transform:uppercase;letter-spacing:.1em;font-size:10px}",
      ".fo-sqg-role.bat{color:#8F6A1C}.fo-sqg-role.ar{color:#177A57}.fo-sqg-role.bowl{color:#22635F}.fo-sqg-role.wk{color:#A63D14}",
      ".fo-sqg-bt{font-family:Inter,sans-serif;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:rgba(20,28,40,.6)}",
      ".fo-sqg td.c-nat,html body #page th.fo-sqg-h.c-nat{min-width:32px;text-align:center}",
      ".fo-sqg-fl{display:inline-block;width:20px;height:14px;border-radius:2px;overflow:hidden;vertical-align:-2px;box-shadow:0 0 0 1px rgba(20,28,40,.12)}",
      ".fo-sqg-fl img{width:100%;height:100%;object-fit:cover;display:block}",
      ".fo-sqg-nat{font-family:Inter,sans-serif;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:rgba(20,28,40,.55)}",
      ".fo-sqg-v{font-family:Inter,sans-serif;font-weight:600;font-size:12.5px;font-variant-numeric:tabular-nums}",
      ".fo-sqg .c-fit{white-space:nowrap}",
      ".fo-sqg-fit{display:inline-block;width:34px;height:5px;border-radius:3px;background:rgba(20,32,47,.12);margin-right:6px;vertical-align:2px;overflow:hidden}",
      ".fo-sqg-fit i{display:block;height:100%;border-radius:3px}",
      "@media(max-width:900px){.fo-sqg-fit{width:22px}}",
      ".fo-sqg td.agg .fo-sqg-v{font-weight:700;font-size:13.5px}",
      ".fo-sqg td.c-ovr .fo-sqg-v{font-size:15px}",
      // the club's own line, under the men
      ".fo-sqg-none{text-align:center;font:400 13px Fraunces,Georgia,serif;color:rgba(20,28,40,.5);height:74px}",
      // the grid is a daylight page like the roster: no art, no veil
      // ---- THE ANALYST'S DESK (the grid view's own clothes) -----------------
      // THE SWITCH DOES NOT MOVE. The grid borrows the roster's exact room -
      // same max width, same 22px gutter, same top inset - and stacks the
      // eyebrow, the title and the switch down the left, so the Roster/Grid
      // control sits on the same spot of the page in both views and never
      // jumps out from under the reader's finger.
      ".fo-sqx.analyst .fo-sqx-in{max-width:1560px;padding:74px 22px 40px;display:block}",
      ".fo-sqx.analyst .fo-sqx-park,.fo-sqx.analyst .fo-sqx-parkin{padding:0;margin:0}",
      ".fo-sqx.analyst .fo-sqa-mast{display:block;margin:0 0 14px}",
      ".fo-sqx.analyst .fo-sqa-ttl .eb{font:600 11px/1 Inter,sans-serif;letter-spacing:.24em;text-transform:uppercase;color:#C08A2E;margin-bottom:9px}",
      ".fo-sqx.analyst .fo-sqa-ttl h1{font:600 38px/1.05 Fraunces,Georgia,serif;color:#14243A !important;margin:0 0 24px;letter-spacing:-.015em;text-shadow:none}",
      // the switch reads as a segmented control on paper, not a dark chip
      ".fo-sqx.analyst .fo-sqx-vsw{display:inline-flex;background:#FFFEFC;border:1px solid rgba(27,36,50,.14);border-radius:10px;padding:3px}",
      "html body #page .fo-sqx.analyst button.fo-sqx-vb{background:transparent !important;color:#67748a !important;border-radius:8px !important;padding:9px 15px !important;letter-spacing:.13em}",
      "html body #page .fo-sqx.analyst button.fo-sqx-vb:hover{background:rgba(27,36,50,.06) !important;color:#14243A !important}",
      "html body #page .fo-sqx.analyst button.fo-sqx-vb.on{background:#14243A !important;color:#F1EEE6 !important}",
      // the book fills the same room the roster's list does
      ".fo-sqx.analyst .fo-sqg-outer{max-width:none;margin:0 0 34px}",
      ".fo-sqa-warn{padding:26px 20px;border:1px solid rgba(27,36,50,.12);border-radius:13px;background:#FFFEFC;color:#7B8698;font:400 13px/1.6 Fraunces,Fraunces,Georgia,serif}",
      "@media(max-width:600px){.fo-sqx.analyst .fo-sqa-ttl h1{font-size:30px}}",
      ".fo-sqx.gridding .fo-sqx-bg,.fo-sqx.gridding .fo-sqx-veil{display:none}",
      // overflow:hidden on the park (it clips the ground art) would make the
      // park the sticky container, and a container that never scrolls cannot
      // pin anything - the heading just slid up under the topbar with the page.
      // No art in this view, so nothing needs clipping.
      ".fo-sqx.gridding .fo-sqx-park{background:transparent;overflow:visible}",
      ".fo-sqx.gridding .fo-sqx-hd h1{color:#1B2432 !important;text-shadow:none}",
      ".fo-sqx.gridding .fo-sqx-tag{color:#B44A22 !important;text-shadow:none}",
      // the view switch reads as paper on both of the views it switches between
      ".fo-sqx-vsw{display:inline-flex;gap:3px;margin-top:12px;padding:3px;border-radius:999px;background:rgba(20,28,40,.05);border:1px solid rgba(20,28,40,.1)}",
      // ---- the tool rail down the left of the park ----
      ".fo-sqx-rail{position:absolute;left:14px;top:50%;transform:translateY(-50%);z-index:3;display:flex;flex-direction:column;gap:4px;padding:8px 6px;border-radius:14px;background:rgba(7,13,24,.66);border:1px solid rgba(126,158,208,.2);backdrop-filter:blur(10px)}",
      "html body #page button.fo-sqx-rb{display:flex;flex-direction:column;align-items:center;gap:3px;width:84px;padding:9px 3px !important;border:0 !important;border-radius:10px !important;cursor:pointer;background:transparent !important;color:#98a9c6 !important;font:600 11px Inter,sans-serif !important;text-transform:uppercase;letter-spacing:.08em;transition:.15s;white-space:nowrap}",
      "html body #page button.fo-sqx-rb:hover{background:rgba(20,32,54,.8) !important;color:#e7eefb !important;border-color:transparent !important}",
      "html body #page button.fo-sqx-rb.on{background:rgba(235,194,113,.14) !important;color:var(--gold) !important}",
      ".fo-sqx-rb b{font-family:Inter,sans-serif;font-weight:700;font-size:15px;letter-spacing:0;color:#f2f6ff;line-height:1}",
      ".fo-sqx-rb .ic{font-size:15px;line-height:1}",
      // the read-out the rail switches
      ".fo-sqx-read{position:relative;z-index:2;display:flex;flex-wrap:wrap;gap:8px 18px;align-items:center;margin-top:8px;padding:10px 14px;border-radius:11px;background:rgba(7,13,24,.6);border:1px solid rgba(126,158,208,.18);font-family:Inter,sans-serif;text-transform:uppercase;letter-spacing:.14em;font-size:10px;color:#93a5c2;backdrop-filter:blur(8px)}",
      ".fo-sqx-read b{color:#f2f6ff;letter-spacing:.08em}",
      ".fo-sqx-read em{font-style:normal;color:var(--gold)}",
      ".fo-sqx-read .warn{color:#F0A868}",
      // ---- the bench ----
      ".fo-sqx-bench{position:relative;z-index:2;margin-top:12px;padding:12px 14px;border-radius:14px;background:rgba(8,14,26,.72);border:1px solid rgba(126,158,208,.16)}",
      ".fo-sqx-bhd{display:flex;align-items:baseline;gap:10px;margin-bottom:9px}",
      ".fo-sqx-bhd b{font-family:Inter,sans-serif;text-transform:uppercase;letter-spacing:.24em;font-size:10px;color:var(--gold)}",
      ".fo-sqx-bhd span{font-family:Inter,sans-serif;letter-spacing:.14em;font-size:10px;color:#6f819e}",
      ".fo-sqx-brow{display:flex;gap:10px;overflow-x:auto;padding-bottom:4px;scrollbar-width:thin}",
      ".fo-sqx-brow .fo-sqx-man{flex:0 0 auto}",
      ".fo-sqx-bempty{font-family:Fraunces,Georgia,serif;font-style:normal;font-size:13px;color:#6f819e}",
      // ---- the roster: daylight browse list ----
      ".fo-sqx.rostering .fo-sqx-bg,.fo-sqx.rostering .fo-sqx-veil{display:none}",
      ".fo-sqx.rostering .fo-sqx-park{background:transparent}",
      ".fo-sqx.rostering .fo-sqx-hd h1{color:#1B2432 !important;text-shadow:none}",
      ".fo-sqx.rostering .fo-sqx-tag{color:#B44A22 !important;text-shadow:none}",
      "html body #page .fo-sqx.rostering button.fo-sqx-vb{background:#FFFEFC !important;border:1px solid rgba(20,28,40,.15) !important;color:rgba(20,28,40,.65) !important}",
      "html body #page .fo-sqx.rostering button.fo-sqx-vb.on{background:#C9571F !important;border-color:#C9571F !important;color:#FFFEFC !important}",
      // THE FLAT SHEET (the manager's pick): navy section bands with the count
      // on the right, then flat hairline rows - no cards, no shadows - and the
      // rating standing alone as a big bare number behind a thin rule
      ".fo-ros{max-width:740px;margin:10px auto 34px;display:flex;flex-direction:column;gap:26px}",
      ".fo-ros-k{display:flex;align-items:baseline;gap:6px;background:#14243A;color:#F1EEE6;border-radius:9px;padding:8px 13px;font-family:Inter,sans-serif;font-size:10.5px;letter-spacing:.22em;text-transform:uppercase;margin-bottom:2px}",
      ".fo-ros-k span{color:#E8B96A;margin-left:auto}",
      ".fo-ros-sec{display:flex;flex-direction:column;gap:0}",
      "html body #page .fo-ros-row{display:grid;grid-template-columns:auto minmax(0,1fr) auto auto;gap:12px;align-items:center;background:transparent;border:0;border-bottom:1px solid rgba(20,28,40,.14);border-radius:0;padding:11px 4px;text-decoration:none;color:#1B2432;box-shadow:none;transition:background .15s ease}",
      "html body #page .fo-ros-row:hover{background:rgba(20,28,40,.035);text-decoration:none}",
      ".fo-ros-pic{position:relative;width:42px;height:42px;border-radius:9px;overflow:hidden;background:#E9E4D8;flex:none;display:block}",
      ".fo-ros-pic img{width:100%;height:100%;object-fit:cover;object-position:50% 10%}",
      ".fo-ros-flag{position:absolute;right:2px;bottom:2px;width:19px;height:14px;border-radius:3px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.4),0 0 0 1.5px rgba(255,255,255,.85);font-style:normal;display:block}",
      ".fo-ros-flag img{width:100%;height:100%;object-fit:cover;display:block}",
      ".fo-ros-id{min-width:0}",
      ".fo-ros-id b{display:block;font:600 14.5px/1.25 Inter,sans-serif;color:#1B2432;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      ".fo-ros-id>span{display:block;font:400 13px/1.35 Inter,sans-serif;color:rgba(20,28,40,.5);margin-top:2px}",
      ".fo-ros-tal{display:flex;flex-wrap:wrap;gap:4px;margin-top:4px}",
      ".fo-ros-tal u{text-decoration:none;font:700 11px/1 Inter,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#8a6d3b;background:rgba(176,132,9,.1);border:1px solid rgba(176,132,9,.28);border-radius:5px;padding:2.5px 6px;white-space:nowrap}",
      ".fo-ros-tal u.m{color:rgba(20,28,40,.45);background:rgba(20,28,40,.05);border-color:rgba(20,28,40,.15)}",
      ".fo-ros-ovr{font-family:Inter,sans-serif;font-weight:700;font-size:23px;font-variant-numeric:tabular-nums;min-width:30px;text-align:right;padding-left:12px;border-left:1px solid rgba(20,28,40,.15)}",
      ".fo-ros-go{display:none}",
      ".fo-ros .fo-sqt-frm .w{display:none}",
      "@media(max-width:480px){.fo-ros-row{gap:9px}}",
      // ---- the dossier ----
      ".fo-sqx-dos{position:sticky;top:64px;border-radius:16px;overflow:hidden;background:linear-gradient(180deg,#FFFEFB,#F4EFE3 62%);border:1px solid rgba(20,28,40,.12);box-shadow:0 18px 44px rgba(30,38,52,.16)}",
      ".fo-sqx-dhero{position:relative;min-height:210px;padding:18px 18px 16px;overflow:hidden}",
      ".fo-sqx-dart{position:absolute;right:-6%;top:0;height:100%;width:auto;object-fit:contain;object-position:right top;opacity:.95;z-index:0;-webkit-mask-image:linear-gradient(90deg,transparent,#000 34%);mask-image:linear-gradient(90deg,transparent,#000 34%)}",
      ".fo-sqx-dhero:after{content:'';position:absolute;inset:0;z-index:1;background:linear-gradient(90deg,#FFFEFB 22%,rgba(255,254,251,.72) 48%,transparent 82%)}",
      ".fo-sqx-did{position:relative;z-index:2;max-width:66%}",
      ".fo-sqx-dno{font-family:Inter,sans-serif;font-weight:700;font-size:20px;color:#B08409;line-height:1}",
      ".fo-sqx-dnm{font-family:Inter,sans-serif;font-weight:700;text-transform:uppercase;font-size:clamp(24px,2.2vw,32px);line-height:1;margin:3px 0 4px;color:#1B2432}",
      ".fo-sqx-drole{font-family:Inter,sans-serif;font-weight:600;text-transform:uppercase;letter-spacing:.1em;font-size:12px;color:#B08409}",
      ".fo-sqx-dcap{display:inline-flex;align-items:center;gap:7px;margin-top:9px;padding:4px 12px 4px 4px;border-radius:999px;background:rgba(235,194,113,.14);border:1px solid rgba(235,194,113,.34);font-family:Inter,sans-serif;text-transform:uppercase;letter-spacing:.16em;font-size:10px;color:var(--gold)}",
      ".fo-sqx-dcap u{width:19px;height:19px;border-radius:50%;background:var(--gold);color:#0d1526;font-weight:700;font-size:11px;line-height:19px;text-align:center;text-decoration:none}",
      ".fo-sqx-dfacts{position:relative;z-index:2;margin-top:12px;display:grid;grid-template-columns:auto 1fr;gap:6px 16px;max-width:70%}",
      ".fo-sqx-dfacts dt{font-family:Inter,sans-serif;text-transform:uppercase;letter-spacing:.16em;font-size:10px;color:#8A8272;align-self:center}",
      ".fo-sqx-dfacts dd{margin:0;font-family:Inter,sans-serif;text-transform:uppercase;letter-spacing:.04em;font-size:11.5px;color:#1B2432;display:flex;align-items:center;gap:6px}",
      ".fo-sqx-dfacts dd img{width:19px;height:13px;object-fit:cover;border-radius:2px}",
      // tabs
      ".fo-sqx-tabs{display:flex;gap:2px;padding:0 10px;border-bottom:1px solid rgba(20,28,40,.12);background:rgba(20,28,40,.04);overflow-x:auto;scrollbar-width:none}",
      ".fo-sqx-tabs::-webkit-scrollbar{display:none}",
      "html body #page button.fo-sqx-tab{position:relative;flex:1 1 0;min-width:0;border:0 !important;border-radius:0 !important;background:transparent !important;cursor:pointer;padding:13px 2px !important;font:600 11px Inter,sans-serif !important;text-transform:uppercase;letter-spacing:.04em;color:#6B7686 !important;white-space:nowrap;transition:color .15s}",
      "html body #page button.fo-sqx-tab:hover{background:transparent !important;color:#1B2432 !important;border-color:transparent !important}",
      "html body #page button.fo-sqx-tab.on{color:#B08409 !important}",
      "html body #page button.fo-sqx-tab.on:after{content:'';position:absolute;left:10px;right:10px;bottom:-1px;height:2px;background:var(--gold)}",
      ".fo-sqx-pane{padding:16px 18px 4px}",
      ".fo-sqx-ph{font-family:Inter,sans-serif;text-transform:uppercase;letter-spacing:.2em;font-size:10px;color:#8A8272;margin:0 0 10px}",
      ".fo-sqx-pcols{display:grid;grid-template-columns:1fr 1fr;gap:18px}",
      // attribute bars
      ".fo-sqx-attr{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:9px;margin-bottom:9px}",
      ".fo-sqx-attr .k{font-family:Inter,sans-serif;text-transform:uppercase;letter-spacing:.1em;font-size:10px;color:#6B7686;min-width:56px}",
      ".fo-sqx-attr .m{height:5px;border-radius:3px;background:rgba(20,28,40,.1);overflow:hidden}",
      ".fo-sqx-attr .m i{display:block;height:100%;border-radius:3px;background:linear-gradient(90deg,#8F6A1C,var(--gold))}",
      ".fo-sqx-attr .v{font-family:Inter,sans-serif;font-weight:600;font-size:12px;color:#1B2432;min-width:22px;text-align:right;font-variant-numeric:tabular-nums}",
      ".fo-sqx-attr.nil .v{color:#9AA3AE}.fo-sqx-attr.nil .m i{background:rgba(20,28,40,.18)}",
      // traits + stars
      ".fo-sqx-trait{display:flex;gap:8px;font-family:Fraunces,Georgia,serif;font-size:12.5px;line-height:1.45;color:#3A4453;margin-bottom:7px}",
      ".fo-sqx-trait s{color:#B08409;text-decoration:none;line-height:1.2}",
      ".fo-sqx-stars{display:flex;gap:3px;font-size:17px;color:rgba(20,28,40,.18);margin-top:4px}",
      ".fo-sqx-stars .on{color:#C89A2E}",
      // form + condition
      ".fo-sqx-frow{display:grid;grid-template-columns:1fr auto;gap:18px;align-items:center;padding:14px 18px;border-top:1px solid rgba(20,28,40,.1)}",
      ".fo-sqx-pips{display:flex;gap:6px;flex-wrap:wrap}",
      ".fo-sqx-pip{font-family:Inter,sans-serif;font-weight:600;font-size:12.5px;min-width:38px;text-align:center;padding:7px 6px;border-radius:7px;background:rgba(20,28,40,.08);color:#1B2432;font-variant-numeric:tabular-nums}",
      ".fo-sqx-pip.hi{background:rgba(22,163,74,.14);color:#177A45}",
      ".fo-sqx-pip.lo{background:rgba(180,45,45,.12);color:#A72F2F}",
      ".fo-sqx-none{font-family:Fraunces,Georgia,serif;font-style:normal;font-size:12.5px;color:#8A8272}",
      ".fo-sqx-ring{position:relative;width:66px;height:66px;flex:0 0 auto}",
      ".fo-sqx-ring svg{transform:rotate(-90deg);display:block}",
      ".fo-sqx-ring circle{fill:none;stroke-width:5}",
      ".fo-sqx-ring .bg{stroke:rgba(20,28,40,.12)}",
      ".fo-sqx-ring .fg{stroke:var(--gold);stroke-linecap:round;transition:stroke-dasharray .5s ease}",
      ".fo-sqx-ring .fg.lo{stroke:#DC6A5A}",
      ".fo-sqx-ring b{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-family:Inter,sans-serif;font-weight:700;font-size:14px;color:#1B2432}",
      ".fo-sqx-cond{display:flex;align-items:center;gap:11px}",
      ".fo-sqx-cond span{font-family:Inter,sans-serif;text-transform:uppercase;letter-spacing:.14em;font-size:10px;color:#6B7686}",
      // actions
      ".fo-sqx-acts{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:14px 18px 18px}",
      "html body #page button.fo-sqx-act{padding:13px 10px !important;border-radius:10px !important;cursor:pointer;font:600 11px Inter,sans-serif !important;text-transform:uppercase;letter-spacing:.14em;transition:.15s}",
      "html body #page button.fo-sqx-act.ghost{background:transparent !important;border:1.5px solid rgba(20,28,40,.3) !important;color:#1B2432 !important}",
      "html body #page button.fo-sqx-act.ghost:hover{border-color:rgba(200,154,46,.8) !important;background:transparent !important;color:#1B2432 !important}",
      "html body #page button.fo-sqx-act.solid{background:linear-gradient(180deg,#E8B96A,#8F6A1C) !important;border:0 !important;color:#0d1526 !important;box-shadow:0 6px 18px rgba(235,194,113,.24)}",
      "html body #page button.fo-sqx-act.solid:hover{background:linear-gradient(180deg,#F5C566,#D4AC52) !important;color:#0d1526 !important;border-color:transparent !important;transform:translateY(-1px);box-shadow:0 10px 24px rgba(235,194,113,.34)}",
      "html body #page button.fo-sqx-act.solid.arm{background:linear-gradient(180deg,#5BD0A6,#2f9d78) !important;color:#062018 !important}",
      ".fo-sqx-hint{grid-column:1/-1;font-family:Fraunces,Georgia,serif;font-style:normal;font-size:12.5px;line-height:1.45;color:#2E7D5B;margin:0}",
      // ---- stacked ----
      // the list wants the whole width - there is no dossier beside it
      "#page .fo-sqx.listing .fo-sqx-in{grid-template-columns:minmax(0,1fr)}",
      // phones: the bars are what make the row wide, so the numbers carry the
      // colour instead and every column fits without a sideways scroll
      // the form cell: arrow always, word only where there is room
      ".fo-sqt-frm{display:inline-flex;align-items:center;gap:5px;white-space:nowrap}",
      ".fo-sqt-frm b{font-size:11px;line-height:1}",
      ".fo-sqt-frm .w{font-family:Inter,sans-serif;font-size:10px;text-transform:uppercase;letter-spacing:.1em}",
      // phones: the headings go to their short forms, the pinned name column
      // narrows, and the grid keeps its sideways scroll rather than dropping
      // columns - a comparison with columns missing is not a comparison
      "@media(max-width:760px){.fo-sqg-cap{font-size:12px}",
      // a phone cannot fit fourteen columns, and the PAGE must never scroll
      // sideways - so on a phone (only) the box keeps its own horizontal bar,
      // and the heading gives up pinning, which a sideways scroller cannot do
      ".fo-sqg-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;border-radius:12px}",
      "html body #page th.fo-sqg-h,html body.ftpskin #page th.fo-sqg-h{position:static;padding:9px 7px !important}",
      ".fo-sqg td.c-name{position:sticky;left:0}",
      ".fo-sqg td{padding:0 8px;height:36px;font-size:12px}",
      "html body #page th.fo-sqg-h,html body.ftpskin #page th.fo-sqg-h{padding:8px !important;letter-spacing:.08em;font-size:10px}",
      ".fo-sqg-h .lg{display:none}.fo-sqg-h .sm{display:inline}",
      ".fo-sqg-frm .w,.fo-sqt-frm .w{display:none}",
      ".fo-sqg-go{display:none}",
      ".fo-sqg-nm{font-size:12.5px;display:inline-block;max-width:112px;overflow:hidden;text-overflow:ellipsis;vertical-align:bottom}",
      ".fo-sqg td.n,html body #page th.fo-sqg-h.n{min-width:36px}",
      ".fo-sqg td.c-name,html body #page th.fo-sqg-h.c-name{min-width:124px;width:124px}",
      ".fo-sqg-ctl{display:grid;grid-template-columns:1fr 1fr;gap:8px}.fo-sqg-pick{display:flex}.fo-sqg-pick select{flex:1;min-width:0}",
      "html body #page .fo-sqg-pick select{padding:6px 24px 6px 9px !important;font-size:10px !important}}",
      "@media(max-width:1180px){.fo-sqx-in{grid-template-columns:minmax(0,1fr);padding-top:58px}.fo-sqx-dos{position:static}",
      ".fo-sqx-rail{position:static;transform:none;flex-direction:row;flex-wrap:wrap;justify-content:center;margin:0 0 10px}",
      "html body #page button.fo-sqx-rb{flex-direction:row;width:auto;gap:7px;padding:8px 13px}.fo-sqx-rb b{font-size:13px}}",
      "@media(max-width:760px){.fo-sqx-in{padding:52px 10px 16px;gap:12px}.fo-sqx-parkin{padding:14px 10px 14px}",
      ".fo-sqx-field{min-height:0;padding:8px 0 4px}.fo-sqx-row{gap:4px}",
      // one frame size for every man on a phone - photo rows and bench alike -
      // sized so six shoulders fit the standing row without a sideways scroll
      "html body #page button.fo-sqx-man{width:clamp(46px,14.4vw,60px);flex:none}",
      ".fo-sqx-row.ph-front{margin-top:-8px}",
      ".fo-sqx-plate b{font-size:10px;letter-spacing:.18em}.fo-sqx-plate{padding:6px 14px}",
      ".fo-sqx-man .nm{font-size:10px;padding:5px 3px 0}.fo-sqx-man .rl{font-size:10px}",
      ".fo-sqx-dfacts,.fo-sqx-did{max-width:100%}.fo-sqx-dart{opacity:.45;right:-14%}",
      ".fo-sqx-pcols{grid-template-columns:1fr;gap:14px}",
      ".fo-sqx-frow{grid-template-columns:1fr;gap:12px}.fo-sqx-acts{grid-template-columns:1fr}}"
    ].join("");
    document.head.appendChild(s);
  }

  // ==== SQUAD v2: the detailed sheet (user-supplied mockup) ==================
  // A denser, more informative roster: club identity in the masthead, a stat
  // band, search/sort/role tools, role-grouped rows with a trait chip, stars
  // and the overall, and a right rail that manages the Selected XI directly.
  // EVERY figure on the page is real game state: the players are the squad
  // the umpire fields, the XI is App.orders.xi (the sheet the engine reads),
  // wages/ages/nationalities come off the men themselves.
  function foS2Css() {
    if (document.getElementById("fo-s2-css")) return;
    var s = document.createElement("style"); s.id = "fo-s2-css";
    s.textContent = [
      "#page .fo-s2-in{max-width:1560px;margin:0 auto;padding:74px 22px 40px;font-family:Inter,-apple-system,'Segoe UI',sans-serif;color:#14243A}",
      ".fo-s2-hd{display:flex;align-items:flex-end;justify-content:space-between;gap:18px;flex-wrap:wrap;margin-bottom:16px}",
      ".fo-s2-ttl .eb{font:600 11px/1 Inter,sans-serif;letter-spacing:.24em;text-transform:uppercase;color:#C08A2E;margin-bottom:9px}",
      ".fo-s2-hd h1{font:600 38px/1.05 Fraunces,Georgia,serif;color:#14243A !important;margin:0;letter-spacing:-.015em;text-shadow:none}",
      // ---- the stat band (view switch attached at its left on desktop) ----
      ".fo-s2-bandwrap{display:flex;align-items:stretch;margin-bottom:14px}",
      ".fo-s2-band{display:flex;flex:1;align-items:stretch;background:#FFFEFC;border:1px solid #e3dccb;border-radius:14px;box-shadow:0 2px 10px rgba(20,36,58,.05);overflow:hidden;min-width:0}",
      ".fo-s2-vsw{display:flex;align-items:center;gap:4px;padding:12px 16px;background:#F6F3EB;border:1px solid #e3dccb;border-radius:14px 0 0 14px}",
      ".fo-s2-vb{font:700 11px Inter,sans-serif;letter-spacing:.14em;text-transform:uppercase;border:1px solid #d9d0bc;background:#FFFEFC;color:#6d6455;border-radius:999px;padding:8px 14px;cursor:pointer}",
      ".fo-s2-vb.on{background:#C9571F;border-color:#C9571F;color:#fff}",
      "html body.ftpskin button.fo-s2-vb{background:#FFFEFC !important;color:#6d6455 !important;border-color:#d9d0bc !important}",
      "html body.ftpskin button.fo-s2-vb.on{background:#C9571F !important;color:#fff !important;border-color:#C9571F !important}",
      ".fo-s2-cell{flex:1;padding:11px 18px;border-right:1px solid #eee7d9;min-width:0}",
      ".fo-s2-cell:last-child{border-right:none}",
      ".fo-s2-cell span{display:block;font:600 11px Inter,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:#8a8272;margin-bottom:3px;white-space:nowrap}",
      ".fo-s2-cell b{font:700 21px Inter,sans-serif;color:#14243A;font-variant-numeric:tabular-nums;white-space:nowrap}",
      ".fo-s2-cell b i{font-style:normal;font-size:13px;color:#8a8272;font-weight:600}",
      ".fo-s2-cell.wage b{color:#C9571F}",
      ".fo-s2-cell.xi b{color:#177A57}",
      // ---- main columns ----
      ".fo-s2-main{display:block}",
      // ---- tools ----
      ".fo-s2-tools{display:flex;align-items:center;gap:8px;flex-wrap:wrap;background:#FFFEFC;border:1px solid #e3dccb;border-radius:12px;padding:10px 12px;margin-bottom:10px}",
      ".fo-s2-q{flex:1 1 170px;min-width:150px;border:1px solid #d9d0bc;border-radius:9px;background:#FBF9F3;padding:8px 12px;font:500 12.5px Inter,sans-serif;color:#14243A}",
      ".fo-s2-q:focus{outline:none;border-color:#C9571F}",
      ".fo-s2-sortw{font:500 13px Inter,sans-serif;color:#6d6455;display:flex;align-items:center;gap:6px}",
      ".fo-s2-sortw select{font:600 13px Inter,sans-serif;color:#14243A;border:1px solid #d9d0bc;border-radius:8px;background:#FFFEFC;padding:7px 8px}",
      // the role filter is a line of words now - see .fo-seg in the boot module
      ".fo-s2-roles{flex:1 0 100%;margin-top:2px}",


      // ---- role sections ----
      ".fo-s2-sec{margin-bottom:12px}",
      ".fo-s2-seck{display:flex;align-items:center;justify-content:space-between;background:#14243A;color:#F6F3EB;border-radius:9px 9px 0 0;padding:7px 14px;font:700 11px Inter,sans-serif;letter-spacing:.2em;text-transform:uppercase}",
      ".fo-s2-seck em{font-style:normal;color:#E8B96A}",
      // ---- rows ----
      ".fo-s2-row{display:grid;grid-template-columns:44px minmax(170px,1.5fr) 92px 58px 136px 74px 78px 46px 26px;gap:10px;align-items:center;background:#FFFEFC;border:1px solid #eee7d9;border-top:none;padding:8px 14px;cursor:pointer}",
      // the standing switch sits above the band, where Grid and Int show it
      ".fo-s2-swrap{margin:0 0 12px}",
      // FORM AND FITNESS, set to read down the column rather than across the
      // row: the word under the arrow and the number beside the gauge, so a
      // reader scanning for a tired man finds him without stopping.
      ".fo-s2-form{display:flex;align-items:center;justify-content:center;min-width:0}",
      ".fo-s2-form .fo-sqt-frm{display:flex;align-items:center;gap:5px}",
      ".fo-s2-form .fo-sqt-frm b{font-size:13px;line-height:1}",
      ".fo-s2-form .fo-sqt-frm .w{font:600 11px Inter,sans-serif;letter-spacing:.1em;text-transform:uppercase}",
      ".fo-s2-fit{display:flex;align-items:center;gap:7px;min-width:0}",
      ".fo-s2-fit i{flex:1;display:block;height:5px;border-radius:3px;background:#EDE7DA;overflow:hidden;min-width:22px}",
      ".fo-s2-fit i u{display:block;height:100%;border-radius:3px}",
      ".fo-s2-fit b{font:700 13px Inter,sans-serif;font-variant-numeric:tabular-nums}",
      ".fo-s2-xibtn:hover{border-color:#177A57}",
      ".fo-s2-xibtn.out{color:#B23230}",
      ".fo-s2-xibtn.out:hover{border-color:#B23230}",
      "html body.ftpskin button.fo-s2-xibtn{background:#FFFEFC !important;color:#177A57 !important;border-color:#d9d0bc !important}",
      "html body.ftpskin button.fo-s2-xibtn.out{color:#B23230 !important}",
      ".fo-s2-row:hover{background:#FBF8F0}",
      ".fo-s2-row.open{background:#FBF6EA}",
      ".fo-s2-sec .fo-s2-row:last-of-type{border-radius:0 0 9px 9px}",
      ".fo-s2-pic{position:relative;width:38px;height:38px}",
      ".fo-s2-pic img.face{width:38px;height:38px;border-radius:50%;object-fit:cover;object-position:top;background:#e8e2d4;border:1.5px solid #d9d0bc}",
      ".fo-s2-flag{position:absolute;left:-5px;bottom:-3px;width:16px;height:12px;border-radius:2px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.3)}",
      ".fo-s2-flag img{width:100%;height:100%;object-fit:cover;display:block}",
      ".fo-s2-id b{display:block;font:700 13.5px Inter,sans-serif;color:#14243A;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      ".fo-s2-id span{display:block;font:500 13px Inter,sans-serif;color:#8a8272;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      ".fo-s2-hand,.fo-s2-age{font:500 13px Inter,sans-serif;color:#4c4437;white-space:nowrap}",
      ".fo-s2-age i{font-style:normal;color:#8a8272}",
      // a talent is one man in nine, so the chip is allowed to be seen from
      // across the page: gold on navy, not a pale cream badge every row wears
      "html body #page .fo-s2-tchip{display:inline-block;font:700 10px/1 Inter,sans-serif;font-style:normal;letter-spacing:.03em;text-transform:uppercase;background:#14243A;color:#E8B96A;border-radius:5px;padding:2px 5px;margin-right:2px;vertical-align:1px}",
      "html body #page .fo-s2-tchip.learn{background:none;border:1px dashed #cbbf9f;color:#8F6A1C}",
      ".fo-s2-trait{justify-self:start;font:700 11px Inter,sans-serif;letter-spacing:.12em;text-transform:uppercase;background:#14243A;color:#E8B96A;border:1px solid #14243A;border-radius:6px;padding:4px 8px;white-space:nowrap;max-width:100%;overflow:hidden;text-overflow:ellipsis}",
      ".fo-s2-trait i{font-style:normal}.fo-s2-trait .sm{display:none}",
      // and the men without one hold the column with a mark that is plainly
      // not a badge
      ".fo-s2-trait.none{background:none;border:0;color:#cfc7b5;padding:4px 0;letter-spacing:0}",
      // on his way to one: hollow, and carrying the number that says so
      ".fo-s2-trait.learn{background:none;border:1px dashed #cbbf9f;color:#8a8272}",
      ".fo-s2-trait.learn em{font-style:normal;color:#b08409;margin-left:5px;font-variant-numeric:tabular-nums}",
      ".fo-s2-stars{white-space:nowrap;font-size:13px;letter-spacing:1px}",
      ".fo-s2-stars .f{color:#E8B96A}.fo-s2-stars .e{color:#e3dccb}",
      ".fo-s2-stars .h{background:linear-gradient(90deg,#E8B96A 50%,#e3dccb 50%);-webkit-background-clip:text;background-clip:text;color:transparent}",
      // the engine's own ten-star markup (foOrdStarHTML), in squad clothes
      ".fo-s2-st10{white-space:nowrap}",
      ".fo-s2-st10 .st{text-decoration:none;font-size:11.5px;letter-spacing:.5px;white-space:nowrap}",
      ".fo-s2-st10 .st em{font-style:normal;color:#e3dccb}",
      ".fo-s2-st10 .st em.f{color:#E8B96A}",
      ".fo-s2-st10 .st em.h{background:linear-gradient(90deg,#E8B96A 50%,#e3dccb 50%);-webkit-background-clip:text;background-clip:text;color:transparent}",
      // bowling stars in the orders room's teal - same craft, same colour
      ".fo-s2-st10.bwl .st em.f{color:#0FB4C4}",
      ".fo-s2-st10.bwl .st em.h{background:linear-gradient(90deg,#0FB4C4 50%,#e3dccb 50%);-webkit-background-clip:text;background-clip:text;color:transparent}",
      ".fo-s2-ovr{font:800 19px Inter,sans-serif;text-align:right;font-variant-numeric:tabular-nums}",
      ".fo-s2-car{color:#b0a794;font-size:11px;text-align:center;transition:transform .15s ease}",
      ".fo-s2-row.open .fo-s2-car{transform:rotate(180deg)}",
      ".fo-s2-xd{border:1px solid #eee7d9;border-top:none;background:#FBFAF7}",
      ".fo-s2-xd .fo-sq-detail{border:none;margin:0;border-radius:0}",
      ".fo-s2-xd .fo-dc-bars{margin-top:0;padding-top:0;border-top:none}",
      ".fo-s2-acts{display:flex;gap:8px;flex-wrap:wrap;padding:0 16px 12px}",
      ".fo-s2-act{font:700 13px Inter,sans-serif;border:1px solid #d9d0bc;background:#FFFEFC;color:#14243A;border-radius:999px;padding:7px 14px;cursor:pointer}",
      ".fo-s2-act.solid{background:#C9571F;border-color:#C9571F;color:#fff}",
      "html body.ftpskin button.fo-s2-act{background:#FFFEFC !important;color:#14243A !important;border-color:#d9d0bc !important}",
      "html body.ftpskin button.fo-s2-act.solid{background:#C9571F !important;color:#fff !important;border-color:#C9571F !important}",
      // ---- the rail ----
      ".fo-s2-rail{display:flex;flex-direction:column;gap:12px;position:sticky;top:66px}",
      ".fo-s2-card{background:#FFFEFC;border:1px solid #e3dccb;border-radius:14px;box-shadow:0 2px 10px rgba(20,36,58,.05);overflow:hidden}",
      ".fo-s2-ck{display:flex;align-items:center;justify-content:space-between;padding:11px 15px 9px;font:700 11px Inter,sans-serif;letter-spacing:.18em;text-transform:uppercase;color:#14243A;border-bottom:1px solid #eee7d9}",
      ".fo-s2-ck em{font-style:normal;color:#177A57;font-variant-numeric:tabular-nums}",
      ".fo-s2-ck a{font:600 12px Inter,sans-serif;letter-spacing:0;text-transform:none;color:#C9571F !important;text-decoration:none;cursor:pointer}",
      ".fo-s2-xirow{display:grid;grid-template-columns:16px 22px minmax(0,1fr) 40px 30px 22px 18px;gap:7px;align-items:center;padding:6px 12px;border-bottom:1px solid #f3eee1;font:600 12.5px Inter,sans-serif;color:#14243A}",
      ".fo-s2-xirow .xrm{border:none;background:none;color:#c9c1ae;font-size:11px;cursor:pointer;padding:2px}",
      ".fo-s2-xirow .xrm:hover{color:#B23230}",
      "html body.ftpskin .fo-s2-xirow .xrm{background:none !important;color:#c9c1ae !important;border:none !important;box-shadow:none !important;padding:2px !important}",
      ".fo-s2-xislot{padding:10px 14px;font:500 13px Fraunces,Georgia,serif;color:#B23230;border-top:1px dashed #e8d5a8;background:#FDF8EE}",
      ".fo-s2-xirow:last-of-type{border-bottom:none}",
      ".fo-s2-xirow.dragover{background:#FBF0D8}",
      ".fo-s2-xirow .grip{color:#c9c1ae;cursor:grab;font-size:11px;letter-spacing:-1px}",
      ".fo-s2-xirow .no{font:700 13px Inter,sans-serif;color:#8a8272;text-align:right;font-variant-numeric:tabular-nums}",
      ".fo-s2-xirow .nm{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      ".fo-s2-xirow .nm u{font-style:normal;text-decoration:none}",
      ".fo-s2-xirow .nm .sh{display:none}",
      ".fo-s2-xirow .ab{font:600 12px Inter,sans-serif;color:#8a8272;text-align:right}",
      ".fo-s2-xirow .bdg{text-align:center}",
      ".fo-s2-xirow .bdg .wk{display:inline-block;font:800 10px Inter,sans-serif;background:#E4EEF6;color:#1f4e6b;border:1px solid #bcd3e4;border-radius:5px;padding:2px 4px}",
      ".fo-s2-xirow .mv{display:flex;flex-direction:column;gap:0}",
      ".fo-s2-xirow .mv button{border:none;background:none;color:#b0a794;font-size:10px;line-height:1;height:11px;min-height:0;cursor:pointer;padding:0 3px}",
      ".fo-s2-xirow .mv button:hover{color:#C9571F}",
      "html body.ftpskin .fo-s2-xirow .mv button{background:none !important;color:#b0a794 !important;border:none !important;box-shadow:none !important;padding:0 3px !important;height:11px !important;min-height:0 !important;line-height:1 !important}",
      // role balance
      ".fo-s2-rb{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:11px 15px 13px}",
      ".fo-s2-rb>div{text-align:left}",
      ".fo-s2-rb span{display:block;font:700 11px Inter,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#8a8272;white-space:nowrap}",
      ".fo-s2-rb b{display:block;font:800 19px Inter,sans-serif;color:#14243A;margin:2px 0 4px}",
      ".fo-s2-rb i{display:block;height:4px;border-radius:2px}",
      // composition + gauges
      ".fo-s2-duo{display:grid;grid-template-columns:1fr 1fr;gap:12px}",
      ".fo-s2-kv{display:flex;align-items:center;justify-content:space-between;padding:6px 15px;font:500 13px Inter,sans-serif;color:#4c4437;border-bottom:1px solid #f3eee1}",
      ".fo-s2-kv:last-child{border-bottom:none}",
      ".fo-s2-kv b{font:700 13px Inter,sans-serif;color:#14243A;font-variant-numeric:tabular-nums}",
      ".fo-s2-kv .fl{width:17px;height:12px;border-radius:2px;overflow:hidden;display:inline-block;vertical-align:-2px;margin-right:6px}",
      ".fo-s2-kv .fl img{width:100%;height:100%;object-fit:cover;display:block}",
      ".fo-s2-gauge{display:flex;align-items:center;gap:11px;padding:11px 15px}",
      ".fo-s2-donut{position:relative;width:56px;height:56px;flex:0 0 56px}",
      ".fo-s2-donut b{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font:800 15px Inter,sans-serif;color:#14243A}",
      ".fo-s2-gauge span{font:600 13px Inter,sans-serif;color:#4c4437;line-height:1.4}",
      ".fo-s2-spark{display:flex;align-items:flex-end;gap:2px;height:30px;flex:0 0 auto}",
      ".fo-s2-spark i{display:block;width:5px;border-radius:2px 2px 0 0;background:#177A57;min-height:3px}",
      ".fo-s2-spark i.lo{background:#C0392E}.fo-s2-spark i.md{background:#D9A21B}",
      // buttons
      ".fo-s2-save{width:100%;font:700 13px Inter,sans-serif;letter-spacing:.2em;text-transform:uppercase;background:#C9571F;color:#fff;border:none;border-radius:11px;padding:14px;cursor:pointer}",
      ".fo-s2-save:hover{background:#B44A22}",
      ".fo-s2-save.dirty{box-shadow:0 0 0 3px rgba(201,87,31,.25);animation:foS2Pulse 1.6s ease infinite}",
      "@keyframes foS2Pulse{0%,100%{box-shadow:0 0 0 3px rgba(201,87,31,.22)}50%{box-shadow:0 0 0 6px rgba(201,87,31,.10)}}",
      ".fo-s2-sugg{width:100%;font:700 11.5px Inter,sans-serif;letter-spacing:.18em;text-transform:uppercase;background:#FFFEFC;color:#14243A;border:1px solid #d9d0bc;border-radius:11px;padding:12px;cursor:pointer}",
      ".fo-s2-sugg:hover{border-color:#C9571F;color:#C9571F}",
      "html body.ftpskin button.fo-s2-save{background:#C9571F !important;color:#fff !important;border:none !important}",
      "html body.ftpskin button.fo-s2-sugg{background:#FFFEFC !important;color:#14243A !important;border-color:#d9d0bc !important}",
      // ---- responsive ----
      "@media(max-width:1100px){.fo-s2-main{grid-template-columns:1fr}.fo-s2-rail{position:static}}",
      // THE PHONE SHEET: a reading page. The search/sort card and the First XI
      // apparatus stay on the desk at the club - the phone shows the roster
      // (bigger stars), the read-outs, and the tap-open detail. XI editing is
      // desktop-only.
      "@media(max-width:820px){",
      ".fo-s2-in{padding:60px 8px 30px}",
      ".fo-s2-hd{align-items:flex-start;flex-direction:column;gap:3px;margin-bottom:8px}",
      ".fo-s2-hd h1{font-size:29px}.fo-s2-ttl .eb{margin-bottom:6px}",
      ".fo-s2-bandwrap{flex-direction:column;gap:8px;margin-bottom:10px}",
      ".fo-s2-vsw{background:transparent;border:none;border-radius:0;padding:0}",
      ".fo-s2-band{border-left:1px solid #e3dccb;border-radius:14px}",
      ".fo-s2-cell{flex:1 1 0;padding:8px 8px;border-right:1px solid #eee7d9}",
      ".fo-s2-cell span{font-size:10px;letter-spacing:.1em;margin-bottom:2px}",
      ".fo-s2-cell b{font-size:14px}.fo-s2-cell b i{display:none}",
      ".fo-s2-tools{display:none}",
      ".fo-s2-row{grid-template-columns:30px minmax(0,1.2fr) auto auto 28px 12px;gap:4px 6px;padding:8px 6px}.fo-s2-pic{grid-column:1;grid-row:1}.fo-s2-id{grid-column:2;grid-row:1;min-width:0}.fo-s2-age{grid-column:3;grid-row:1}.fo-s2-st10{grid-column:4;grid-row:1}.fo-s2-ovr{grid-column:5;grid-row:1}.fo-s2-car{grid-column:6;grid-row:1}",
      ".fo-s2-hand,.fo-s2-form,.fo-s2-fit{display:none}",
      ".fo-s2-pic{width:30px;height:30px}.fo-s2-pic img.face{width:30px;height:30px}",
      ".fo-s2-flag{width:13px;height:9px;left:-4px;bottom:-2px}",
      ".fo-s2-id b{font-size:11.5px}.fo-s2-id span{font-size:10px}",
      ".fo-s2-age{font-size:10px;padding-left:3px}.fo-s2-age i{font-size:10px}",
      // the short name below fits the column, so the chip never ellipses
      ".fo-s2-tchip{font-size:10px;padding:2px 4px}",
      ".fo-s2-trait .lg{display:none}.fo-s2-trait .sm{display:inline}",
      // the learning chip carries a name AND a number in the same column, so
      // it gets the tighter setting or the name ellipses away to nothing
      ".fo-s2-trait.learn{font-size:10px;letter-spacing:0;padding:3px 3px}",
      ".fo-s2-trait.learn em{margin-left:3px}",
      ".fo-s2-st10 .st{font-size:10px;letter-spacing:.5px}",
      ".fo-s2-ovr{font-size:15px}",
      ".fo-s2-car{font-size:10px}",
      ".fo-s2-seck{font-size:10px;letter-spacing:.14em;padding:6px 10px}",
      // detail bars stack one a line on a narrow screen
      ".fo-s2-xd .fo-dc-bars{grid-auto-flow:row;grid-template-columns:1fr;grid-template-rows:none;gap:4px}",
      // First XI management is a desk job - the card, its save and the
      // add/remove taps all stay on desktop
      ".fo-s2-xicard,.fo-s2-save,.fo-s2-sugg,.fo-s2-acts .fo-s2-act[data-xit]{display:none}",
      ".fo-s2-duo{grid-template-columns:1fr 1fr;gap:8px}",
      "}"
    ].join("\n");
    document.head.appendChild(s);
  }
  // half-precision stars for a 1-99 overall
  function foS2Stars(ovr) {
    var v = Math.max(0.5, Math.min(5, Math.round(ovr / 10) / 2)), out = "";
    for (var i = 1; i <= 5; i++) {
      out += i <= v ? "<span class='f'>&#9733;</span>"
        : (i - 0.5 === v ? "<span class='h'>&#9733;</span>" : "<span class='e'>&#9733;</span>");
    }
    return "<span class='fo-s2-stars'>" + out + "</span>";
  }
  // THE TALENT CHIP MEANS A TALENT, AND NOTHING ELSE.
  //
  // This column used to fall back to a "read" when a man had no talent - a
  // label derived from his best skill, in the same gold chip, in the same
  // words. "vs SPIN", "MISER", "ANCHOR" and "SAFE" are all real talents AND
  // were all reads, so a squad in which one man in fifteen was gifted printed
  // fifteen identical-looking chips. The generator was right - the world runs
  // at 11.6% and the newcomer's club was dealt exactly one - and the roster
  // was quietly saying the opposite. A rare thing that is drawn on every row
  // is not rare, whatever the data says.
  //
  // So the chip is a talent or it is nothing. A man without one gets a faint
  // dash, which holds the grid column and reads as the absence it is.
  //
  // A CHIP THAT SAYS "PARTNE..." SAYS NOTHING. The roster row prints a man's
  // talent in a fixed grid column, and on a phone "SIX MACHINE" and "NEW BALL
  // SPECIALIST" ran straight into an ellipsis - the one word that tells you
  // what the player IS, cut off exactly where the meaning lives. Widening the
  // column is not available: the row already carries a face, a name, a role, an
  // age, ten stars and a rating inside 390 pixels.
  //
  // So the chip gets a SHORT NAME that always fits, and the full name and what
  // the talent actually does ride along in the tooltip. Every short form is a
  // word a cricketer would use - "vs SPIN", "NEW BALL", "DEATH" - so nothing is
  // learned from the long name that the short one does not already say.
  var FO_TAL_SHORT = {
    fastStarter: "STARTER", anchor: "ANCHOR", finisher: "FINISHER",
    sixMachine: "SIXES", spinKiller: "vs SPIN", paceHunter: "vs PACE",
    busyRunner: "RUNNER", newBallSpecialist: "NEW BALL", deathSpecialist: "DEATH",
    partnershipBreaker: "BREAKER", bouncer: "BOUNCER", miser: "MISER",
    goldenArm: "GOLDEN", mysteryBall: "MYSTERY", lightningHands: "GLOVES",
    safeHands: "SAFE", rocketArm: "ROCKET"
  };
  // the full name and the effect, for the chip's title
  function foS2TraitTip(p) {
    try {
      var t = (p.talents || [])[0];
      if (!t) return "";
      var nm = (typeof TALN !== "undefined" && TALN[t]) || t;
      var tip = "";
      try { tip = (typeof TALTIPS !== "undefined" && TALTIPS[t]) || ""; } catch (eT) {}
      return tip ? nm + " - " + tip : nm;
    } catch (e) { return ""; }
  }
  // WHAT HE IS ON HIS WAY TO. A talent can be earned: keep finding yourself in
  // the situation one describes and doing the job, and eventually it is yours.
  // The roster says so, because a manager who cannot see it happening has no
  // reason to keep picking the man. It must never be mistaken for the real
  // thing though - that was the whole of the last mistake here - so it is a
  // hollow chip with a number on it, next to nothing that looks like a badge.
  function foS2Learning(p) {
    try {
      var prog = p && p.talProg; if (!prog) return null;
      var T = window.FO_TAL_T || {};
      var best = null, bestR = 0;
      for (var t in prog) {
        var cap = T[t] || 0; if (!cap) continue;
        var r = window.foTalChance ? window.foTalChance(prog[t] | 0, cap)
                                   : Math.max(0, Math.min(0.99, (prog[t] | 0) / cap));
        if (r > bestR) { bestR = r; best = t; }
      }
      return best ? { t: best, r: bestR } : null;
    } catch (e) { return null; }
  }
  function foS2LearnTip(L) {
    if (!L) return "";
    var nm = (typeof TALN !== "undefined" && TALN[L.t]) || L.t;
    return "Learning " + nm + " \u00b7 he already does it on " + Math.round(L.r * 100) +
      " balls in a hundred that suit it. It moves a tenth at a time; at a hundred it is his for good.";
  }
  function foS2Trait(p, short) {
    try {
      var t = (p.talents || [])[0];
      if (!t) return "";
      if (short && FO_TAL_SHORT[t]) return FO_TAL_SHORT[t];
      var nm = (typeof TALN !== "undefined" && TALN[t]) || String(t).replace(/([A-Z])/g, " $1");
      return nm.toUpperCase();
    } catch (e) { return ""; }
  }
  // THE STARS ARE HIS CRAFT'S STARS. The same ten-star read the scorecard,
  // the orders room and the live theatre print (foOrdBatComp / foOrdBowlComp
  // through foOrdStars): a batter wears his batting stars, a bowler his
  // bowling, an all-rounder his stronger craft, a keeper his batting. One
  // star language across the whole game - never a second scale to reconcile.
  function foS2RoleStars(p, cls, ovr) {
    try {
      var sf = window.foStarsFor;
      if (sf) {
        var cb = sf.bat(p);
        var cw = p.bowlType ? sf.bowl(p) : null;
        // when the stars shown are his BOWLING, they wear the orders room's
        // bowling teal, so one glance says which craft is being rated
        var useBowl = (cls === "bowl" && cw != null) || (cls === "ar" && cw != null && cw > cb);
        var comp = useBowl ? cw : cb;
        return "<span class='fo-s2-st10" + (useBowl ? " bwl" : "") + "'>" + sf.html(sf.stars(comp)) + "</span>";
      }
    } catch (eSt) {}
    return foS2Stars(ovr);
  }
  // the XI rail's style abbreviation: a bowler wears his arm and craft, a
  // batter his hand - RHB / LHB / RFM / LWS, straight off the man's record
  function foS2Abbr(p) {
    if (p.bowlType) {
      var L = p.hand === "L";
      // the scorebook's own abbreviations: RFM, LM, OB, SLA, LB, SLC
      if (p.bowlType === "fingerSpin" || p.bowlType === "offSpin") return L ? "SLA" : "OB";
      if (p.bowlType === "wristSpin") return L ? "SLC" : "LB";
      var t = { fast: "F", fastMedium: "FM", medium: "M" }[p.bowlType] || "M";
      return (L ? "L" : "R") + t;
    }
    return p.hand === "L" ? "LHB" : "RHB";
  }
  function foS2Money(n) { return "$" + Math.round(n || 0).toLocaleString(); }
  function foS2Donut(pct, col) {
    var C = 2 * Math.PI * 23;
    return "<div class='fo-s2-donut'><svg width='56' height='56' viewBox='0 0 56 56'>" +
      "<circle cx='28' cy='28' r='23' fill='none' stroke='#efe9da' stroke-width='7'></circle>" +
      "<circle cx='28' cy='28' r='23' fill='none' stroke='" + col + "' stroke-width='7' stroke-linecap='round'" +
      " stroke-dasharray='" + (C * pct / 100).toFixed(1) + " " + C.toFixed(1) + "' transform='rotate(-90 28 28)'></circle>" +
      "</svg><b>" + pct + "</b></div>";
  }

  window.pgSquad = function () {
    try {
      foSqxCss(); foS2Css();
      var t = userTeam();
      (t.players || []).forEach(foEnsureTraining); (t.youth || []).forEach(foEnsureTraining);
      window.squadView = window.squadView || {};
      var sv = window.squadView;
      sv.mode = sv.mode || "xi"; sv.tab = ["ovr", "bat", "bwl", "fld", "rec"].indexOf(sv.tab) >= 0 ? sv.tab : "ovr";
      // THREE WAYS TO READ A SQUAD. The roster is people - a face, a role, one
      // number - and it stays the front door. The grid is the comparison: every
      // attribute the engine holds, sortable on any of them. Int is the
      // analyst's read: what each man is worth, at what age, and where the
      // squad is thin. The park view is retired; the choice is remembered on
      // the device, because a manager who prefers the numbers prefers them daily.
      if (SQ_VIEWS.indexOf(sv.view) < 0) {
        var vSaved = null;
        try { vSaved = localStorage.getItem("fo_sq_view"); } catch (eV) {}
        sv.view = SQ_VIEWS.indexOf(vSaved) > 0 ? vSaved : "roster";
      }
      sv.who = ["sen", "yth", "all"].indexOf(sv.who) >= 0 ? sv.who : "sen";
      sv.sortK = sv.sortK || "ovr"; sv.sortDir = sv.sortDir === 1 ? 1 : -1;
      var seniors = (t.players || []).map(function (p) { return Object.assign({}, p); });
      var youths = (t.youth || []).map(function (p) { return Object.assign({ __y: true }, p); });
      var byName = {}; seniors.concat(youths).forEach(function (p) { byName[p.name] = p; });

      // THE FIRST XI, IN BATTING ORDER. Seeded from the saved orders - the
      // eleven from App.orders.xi arranged by App.orders.batOrder, so this
      // list and the match orders page always open on the same card. Only
      // rebuilt when it is missing or names a man who has left; a list mid-
      // edit (ten men while a change is made) is a legitimate state.
      if (!sv.xi || sv.xi.some(function (n) { return !byName[n] || byName[n].__y; })) {
        var base = null;
        try { if (typeof App !== "undefined" && App.orders && App.orders.xi && App.orders.xi.length === 11) base = App.orders.xi.slice(); } catch (eO) {}
        if (!base || base.some(function (n) { return !byName[n] || byName[n].__y; })) {
          try { base = pickXI(t).map(function (p) { return p.name; }); } catch (eP) { base = null; }
        }
        if (!base || base.length !== 11) base = seniors.slice(0, 11).map(function (p) { return p.name; });
        try {
          var bo = (App.orders && App.orders.batOrder) || [];
          if (bo.length) base = base.slice().sort(function (a, b) {
            var ia = bo.indexOf(a), ib = bo.indexOf(b);
            return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
          });
        } catch (eBo) {}
        sv.xi = base;
        sv.xiDirty = 0;
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
        var fIx = p.formIx == null ? 3 : p.formIx;
        return "<button type='button' class='fo-sqx-man" + (p.name === sv.sel ? " sel" : "") + (swap ? " tgt" : "") + (en.tired ? " wkn" : "") + "' data-n='" + E(p.name) + "'>" +
          (n ? "<span class='no'>" + n + "</span>" : "") +
          (fIx >= 5 ? "<span class='frm hi' title='In form'>&#9650;</span>" : fIx <= 2 ? "<span class='frm lo' title='Out of form'>&#9660;</span>" : "") +
          "<img class='pic' src='" + FO_ART + foPkArt(p) + "' alt='' loading='lazy' decoding='async'>" + extra +
          "<span class='nm'>" + E(foSqShortName(p.name)) + foSqStar(p) + "</span>" +
          "<span class='rl " + cls + "'>" + E(sub) + "</span></button>";
      };

      // the XI stands for its team photograph, the way cricket has always
      // presented an eleven: six standing behind, five seated in front -
      // captain centre, keeper at his side, the senior pros beside them.
      // Batting order lives on the number badges, not in the geometry.
      var photoIdx = xi.map(function (p, ix) { return { p: p, ix: ix }; });
      var seatScore = function (e) {
        return (e.p.name === capt ? 1000 : 0) + (e.p.keeper ? 500 : 0) + ((e.p.age | 0) * 2) + ((e.p.exp | 0) / 50);
      };
      var seated = photoIdx.slice().sort(function (a, b) { return seatScore(b) - seatScore(a); }).slice(0, Math.min(5, photoIdx.length));
      var seatedSet = {}; seated.forEach(function (e) { seatedSet[e.ix] = 1; });
      var standing = photoIdx.filter(function (e) { return !seatedSet[e.ix]; });
      // captain to the middle chair, rank fanning outward: 4-2-1-3-5
      var frontArr = [];
      seated.forEach(function (e, i) { if (i % 2) frontArr.unshift(e); else frontArr.push(e); });
      var rowHTML = function (arr, cls2) {
        return "<div class='fo-sqx-row " + cls2 + "'>" + arr.map(function (e) { return manHTML(e.p, e.ix + 1); }).join("") + "</div>";
      };
      var rows = rowHTML(standing, "ph-back") + rowHTML(frontArr, "ph-front") +
        "<div class='fo-sqx-plate'><b>" + E(t.name) + "</b><span>First XI &middot; Season " + (window.foSeasonN ? foSeasonN(App.seasonNo || 1) : (App.seasonNo || 1)) + "</span></div>";

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
          "</svg><b>" + en2.pct + "%</b></div><span>" + (en2.tired ? "Needs a rest" : "Match fit") +
          " <em class='fo-sqx-dfrm'>" + foSqFormGlyph(sel) + "</em></span></div>";

        dos = "<aside class='fo-sqx-dos'>" +
          "<div class='fo-sqx-dhero'>" +
          "<img class='fo-sqx-dart' src='" + FO_ART + foPkArt(sel) + "' alt='' decoding='async'>" +
          "<div class='fo-sqx-did'>" +
          (selIx >= 0 ? "<div class='fo-sqx-dno'>" + ("0" + (selIx + 1)).slice(-2) + "</div>" : "<div class='fo-sqx-dno'>&mdash;</div>") +
          "<h2 class='fo-sqx-dnm'>" + E(sel.name) + "</h2>" +
          "<div class='fo-sqx-drole'>" + E(foPkRoleLbl(sel) || "Player") + " (" + (sel.hand === "L" ? "LHB" : "RHB") + ")</div>" +
          (sel.__y ? "<div class='fo-sqx-dcap'><u>Y</u>Youth</div>"
            : selIx < 0 ? "<div class='fo-sqx-dcap'><u>B</u>Bench</div>" : "") +
          "</div>" + facts +
          "</div>" +
          "<div class='fo-sqx-tabs'>" + tabs + "</div>" +
          "<div class='fo-sqx-pane'>" + pane + "</div>" +
          "<div class='fo-sqx-frow'><div><div class='fo-sqx-ph'>Recent form</div><div class='fo-sqx-pips'>" + pips + "</div></div>" + ring + "</div>" +
          "<div class='fo-sqx-acts'>" +
          "<button type='button' class='fo-sqx-act ghost' id='fo-sqx-view'>View full profile</button>" +
          (sel.__y
            ? "<button type='button' class='fo-sqx-act solid' id='fo-sqx-promote'>Promote to seniors</button>" +
              (foSqWorld() ? "<button type='button' class='fo-sqx-act ghost' id='fo-sqx-release'>Release</button>" : "")
            : "<button type='button' class='fo-sqx-act solid" + (sv.arm === sel.name ? " arm" : "") + "' id='fo-sqx-sub'>" + (sv.arm === sel.name ? "Cancel swap" : "Make substitution") + "</button>") +
          (sv.arm ? "<p class='fo-sqx-hint'>" + E(foSqShortName(sv.arm)) + " is ready to swap - tap the man " + (xiSet[sv.arm] ? "on the bench" : "on the park") + " who changes places with him.</p>" : "") +
          "</div></aside>";
      }

      var page = document.getElementById("page"); if (!page) return;
      document.body.classList.add("fo-sqx-on");

      // the switch: three chips, in the masthead, in the same place on all
      // three views, so toggling never moves the control under the finger
      var VIEWLBL = [["roster", "Roster"], ["grid", "Grid"], ["int", "Int"]];
      var viewSwitch = "<div class='fo-sqx-vsw'>" +
        VIEWLBL.map(function (v) {
          return "<button type='button' class='fo-sqx-vb" + (sv.view === v[0] ? " on" : "") + "' data-view='" + v[0] + "'>" + v[1] + "</button>";
        }).join("") + "</div>";

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

      // ==== SQUAD v2 roster (the user's mockup, on real state) ==============
      var prettyType = function (t) {
        if (!t) return "";
        return String(t).replace(/([A-Z])/g, " $1").toLowerCase().replace(/^./, function (c) { return c.toUpperCase(); });
      };
      sv.q = sv.q || ""; sv.roleF = sv.roleF || "all";
      sv.s2sort = sv.s2sort || "ovr-";
      var kpr = null;
      try { kpr = (App.orders && App.orders.keeper) || null; } catch (eK) {}
      if (!kpr || !xiSet[kpr]) kpr = (xi.filter(function (p) { return p.keeper; })[0] || {}).name || null;

      // THE MASTHEAD CARRIES NO CREST. It used to hold the club's badge, its
      // name, and a line of provenance - Est. 2026, Club ID, the season - all
      // of which the page already answers: the eyebrow above the title names
      // the season and the day, and a manager on his own squad page knows
      // whose squad it is. A crest here was decoration standing where the
      // reading starts.

      // the band's figures, straight off the men
      var wageSum = seniors.reduce(function (s2, p) { return s2 + (+p.wage || 0); }, 0);
      var ageAvg = seniors.length ? (seniors.reduce(function (s2, p) { return s2 + (p.age | 0); }, 0) / seniors.length) : 0;
      var homeNat = t.country || (seniors[0] && seniors[0].nat) || "";
      var overseas = seniors.filter(function (p) { return p.nat && homeNat && p.nat !== homeNat; });

      // ONE SWITCH, IN ONE STYLE. The roster used to carry its own compact
      // switch tucked inside the stat band while Grid and Int used the standing
      // one below the title - the same three words in two different shapes,
      // moving as you toggled. There is one switch now, the Grid/Int one, and
      // the roster shows it where the other two do.
      var band = "";

      var header =
        "<header class='fo-s2-hd'>" +
        "<div class='fo-s2-ttl'><div class='eb'>" + foSqEyebrow(sv) + "</div><h1>The squad</h1></div>" +
        "</header>";

      // ---- tools ----
      var SORTS = [["ovr-", "Rating: High to Low"], ["ovr+", "Rating: Low to High"], ["age+", "Age: Youngest first"], ["age-", "Age: Oldest first"], ["name+", "Name: A to Z"], ["wage-", "Wage: High to Low"]];
      var ROLEF = [["all", "All"], ["bat", "Batters"], ["ar", "All-rounders"], ["bowl", "Bowlers"], ["wk", "Wicketkeepers"]];
      var tools =
        "<div class='fo-s2-tools'>" +
        "<input class='fo-s2-q' id='fo-s2-q' type='search' placeholder='Search players...' value='" + E(sv.q) + "'>" +
        "<label class='fo-s2-sortw'>Sort by <select id='fo-s2-sort'>" + SORTS.map(function (o) {
          return "<option value='" + o[0] + "'" + (sv.s2sort === o[0] ? " selected" : "") + ">" + o[1] + "</option>";
        }).join("") + "</select></label>" +
        "<div class='fo-seg fo-s2-roles'>" + ROLEF.map(function (c) {
          return "<button type='button' class='fo-s2-chip" + (sv.roleF === c[0] ? " on" : "") + "' data-rf='" + c[0] + "'>" + c[1] + "</button>";
        }).join("") + "</div>" +
        "</div>";

      // ---- the list, grouped by role ----
      var sortMen = function (arr) {
        var k = sv.s2sort;
        return arr.slice().sort(function (a, b) {
          if (k === "ovr+") return foPkOvr(a) - foPkOvr(b);
          if (k === "age+") return (a.age | 0) - (b.age | 0);
          if (k === "age-") return (b.age | 0) - (a.age | 0);
          if (k === "name+") return a.name < b.name ? -1 : 1;
          if (k === "wage-") return (+b.wage || 0) - (+a.wage || 0);
          return foPkOvr(b) - foPkOvr(a);
        });
      };
      var q9 = sv.q.trim().toLowerCase();
      var s2Row = function (p) {
        var ovr = foPkOvr(p), rCls = foSqClass(p);
        var flg = "";
        try { flg = FO_ART + "flags/" + ((typeof FO_FLAG_FILE !== "undefined" && FO_FLAG_FILE[foSqNatId(p.nat)]) || foSqNatId(p.nat)) + ".svg"; } catch (eFg) {}
        var roleNm = { bat: "Batsman", ar: "All-rounder", wk: "Wicketkeeper", bowl: "Bowler" }[rCls] || "Player";
        var det = p.bowlType ? prettyType(p.bowlType) : (p.hand === "L" ? "LHB" : "RHB");
        var open = sv.open === p.name;
        var inXi = xiSet[p.name];
        var xd = "";
        if (open) {
          xd = "<div class='fo-s2-xd'>" + foSqDetail(p, !!p.__y) +
            "<div class='fo-s2-acts'>" +
            "<button type='button' class='fo-s2-act' data-goman='" + E(p.name) + "'>Full profile &rsaquo;</button>" +
            (inXi && p.name !== capt ? "<button type='button' class='fo-s2-act' data-mkc='" + E(p.name) + "'>Make captain</button>" : "") +
            (inXi && p.keeper && p.name !== kpr ? "<button type='button' class='fo-s2-act' data-mkk='" + E(p.name) + "'>Give the gloves</button>" : "") +
            (p.__y ? "<button type='button' class='fo-s2-act solid' data-ypro='" + E(p.name) + "'>Promote to seniors</button>" +
              (foSqWorld() ? "<button type='button' class='fo-s2-act' data-yrel='" + E(p.name) + "'>Release</button>" : "") : "") +
            "</div></div>";
        }
        return "<div class='fo-s2-row" + (open ? " open" : "") + "' data-open='" + E(p.name) + "'>" +
          "<span class='fo-s2-pic'><img class='face' src='" + FO_ART + foPkArt(p) + "' alt='' loading='lazy' decoding='async'>" +
          (flg && p.nat ? "<em class='fo-s2-flag'><img src='" + flg + "' alt='" + E(p.nat) + "' onerror=\"this.parentNode.style.display='none'\"></em>" : "") + "</span>" +
          "<span class='fo-s2-id'><b>" + E(p.name) + foSqStar(p) + "</b><span>" +
          (function () {
            if ((p.talents || []).length)
              return "<em class='fo-s2-tchip' title='" + E(foS2TraitTip(p)) + "'>" + E(foS2Trait(p, 1)) + "</em> ";
            var L = foS2Learning(p);
            if (L) return "<em class='fo-s2-tchip learn' title='" + E(foS2LearnTip(L)) + "'>" + E(FO_TAL_SHORT[L.t] || L.t) + " " + Math.round(L.r * 100) + "%</em> ";
            return "";
          })() + roleNm + " &middot; " + E(det) + (p.__y ? " &middot; Youth" : "") + "</span></span>" +
          "<span class='fo-s2-hand'>" + (p.hand === "L" ? "Left Hand" : "Right Hand") + "</span>" +
          "<span class='fo-s2-age'><i>Age</i> " + (p.age | 0) + "</span>" +
          foS2RoleStars(p, rCls, ovr) +
          // FORM AND FITNESS READ ON THE ROW. They are the two things that
          // decide whether a man is worth picking this week, and they were
          // only in the Grid - so choosing a side meant reading one view and
          // remembering it in the other. Same glyph and same gauge as the
          // Grid uses, so the two views agree at a glance.
          "<span class='fo-s2-form'>" + foSqFormGlyph(p) + "</span>" +
          (function () {
            var en = { pct: 100, raw: "rested", tired: false };
            try { en = foEnergyOf(p); } catch (eEn) {}
            var fc = en.tired ? "#B23230" : en.pct >= 80 ? "#177A57" : "#8F6A1C";
            return "<span class='fo-s2-fit' title='" + E("Fitness: " + en.raw + " (" + en.pct + "%)") + "'>" +
              "<i><u style='width:" + en.pct + "%;background:" + fc + "'></u></i>" +
              "<b style='color:" + fc + "'>" + en.pct + "</b></span>";
          })() +
          "<b class='fo-s2-ovr' style='color:" + foSqQCol(ovr) + "'>" + ovr + "</b>" +
          "<span class='fo-s2-car'>&#9660;</span>" +
          "</div>" + xd;
      };
      var listBody = [["bat", "Batters"], ["ar", "All-rounders"], ["bowl", "Bowlers"], ["wk", "Wicketkeepers"]].map(function (sec) {
        if (sv.roleF !== "all" && sv.roleF !== sec[0]) return "";
        var men = seniors.filter(function (p) { return foSqClass(p) === sec[0]; });
        if (q9) men = men.filter(function (p) { return p.name.toLowerCase().indexOf(q9) >= 0; });
        if (!men.length) return "";
        men = sortMen(men);
        return "<div class='fo-s2-sec'><div class='fo-s2-seck'><span>" + sec[1] + "</span><em>" + men.length + " player" + (men.length === 1 ? "" : "s") + "</em></div>" +
          men.map(s2Row).join("") + "</div>";
      }).join("");
      // the boys close the roster in a room of their own: an academy list at
      // the foot of the page, not four sixteen-year-olds filed among the
      // senior batters as if they were their equals
      if (sv.roleF === "all" && youths.length) {
        var boys9 = q9 ? youths.filter(function (p) { return p.name.toLowerCase().indexOf(q9) >= 0; }) : youths;
        if (boys9.length) {
          listBody += "<div class='fo-s2-sec'><div class='fo-s2-seck'><span>Youth</span><em>" +
            boys9.length + (boys9.length === 1 ? " boy" : " boys") + " &middot; academy, under twenty-one</em></div>" +
            sortMen(boys9.slice()).map(s2Row).join("") + "</div>";
        }
      }
      listBody = listBody || "<div class='fo-s2-sec'><div class='fo-s2-row' style='border-top:1px solid #eee7d9;border-radius:9px;cursor:default'>Nobody matches that search.</div></div>";

      // THE RAIL IS GONE, AND WITH IT THE WHOLE FIRST XI APPARATUS.
      //
      // It carried the XI in batting order, role balance, squad composition, a
      // team-balance gauge, a chemistry-and-form gauge, Save First XI and
      // Suggest best XI. Naming a side belongs to the match orders, which is
      // where it is actually done and where it can be checked against an
      // opponent; a second place to do it half-way meant two answers to one
      // question. Squad composition went with it because the band above the
      // list already states every figure it held - the count, the average age,
      // the overseas players and the wage bill.
      //
      // What the reader gets back is the width. The list runs the full page
      // now, which is what makes room for form and fitness on every row.

      var roster2Body = header +
        "<div class='fo-s2-swrap'>" + viewSwitch + "</div>" + band +
        "<div class='fo-s2-main'><section>" + tools + listBody + "</section></div>";

      var gridMen = sv.who === "yth" ? youths : sv.who === "all" ? everyone : seniors;
      var gridBody = sv.view === "grid" ? foSqGrid(gridMen, sv, xiIx) : "";

      // THE ANALYST'S DESK: a gilt eyebrow, a plain masthead, and then the
      // book itself. The view switch sits below the title on the left, on
      // the same line of the page it holds on the roster, so toggling the
      // two views never moves the control under the reader's finger.
      var ebA = foSqEyebrow(sv);

      // Int borrows the Grid's shell whole - the same eyebrow, the same
      // masthead, the same switch on the same line - so the three views are
      // one room with three lights on rather than three pages.
      var deskBody = gridBody;
      if (sv.view === "int") {
        try { deskBody = window.__foSquadIntel.body(sv); }
        catch (eI) {
          console.warn("squad intelligence", eI);
          deskBody = "<div class='fo-sqa-warn'>The analyst&#39;s read could not be drawn. The roster and the grid are unaffected.</div>";
        }
      }
      page.innerHTML = sv.view === "roster"
        ? "<div class='fo-sqx listing rostering'><div class='fo-s2-in'>" + roster2Body + "</div></div>"
        : "<div class='fo-sqx listing gridding analyst" + (sv.view === "int" ? " intel" : "") + "'><div class='fo-sqx-in'>" +
          "<section class='fo-sqx-park'><div class='fo-sqx-parkin'>" +
          "<header class='fo-sqa-mast'>" +
          "<div class='fo-sqa-ttl'><div class='eb'>" + ebA + "</div><h1>The squad</h1></div>" +
          viewSwitch + "</header>" + deskBody +
          "</div></section></div></div>";

      // ---- wiring ----
      if (sv.view === "int") {
        try { window.__foSquadIntel.wire(page, sv, pgSquad); } catch (eIW) { console.warn("squad intelligence wiring", eIW); }
      }
      page.querySelectorAll(".fo-sqx-vb").forEach(function (b) {
        b.addEventListener("click", function () {
          sv.view = b.getAttribute("data-view"); sv.viewSet = 1;
          try { localStorage.setItem("fo_sq_view", sv.view); } catch (eV2) {}
          pgSquad();
        });
      });
      // a repaint must not move the manager's viewport: he sorted a column he
      // had scrolled TO, so the grid keeps its sideways scroll (and the page
      // its height) instead of snapping back to the left edge
      var repaintInPlace = function () {
        var wr = page.querySelector(".fo-sqg-wrap");
        var x = wr ? wr.scrollLeft : 0, y = window.scrollY;
        pgSquad();
        var wr2 = page.querySelector(".fo-sqg-wrap");
        if (wr2 && x) wr2.scrollLeft = x;
        try { window.scrollTo(0, y); } catch (eY) {}
      };
      // sorting: same column flips direction, a new column starts descending
      // (best first), except the name, the position and the age, where lowest
      // first is what anyone expects
      page.querySelectorAll(".fo-sqg-h").forEach(function (h) {
        h.addEventListener("click", function () {
          var k = h.getAttribute("data-sort");
          if (k === sv.sortK) sv.sortDir = -sv.sortDir;
          else { sv.sortK = k; sv.sortDir = (k === "name" || k === "pos" || k === "age" || k === "wage") ? 1 : -1; }
          repaintInPlace();
        });
      });
      page.querySelectorAll("select[data-show]").forEach(function (sel2) {
        sel2.addEventListener("change", function () { sv.who = sel2.value; repaintInPlace(); });
      });
      page.querySelectorAll("select[data-role]").forEach(function (sel3) {
        sel3.addEventListener("change", function () { sv.role = sel3.value; repaintInPlace(); });
      });
      // every row is a door to the man's full profile
      var openMan = function (n) { if (n) location.hash = "#/player?n=" + encodeURIComponent(n); };
      page.querySelectorAll(".fo-sqg-r").forEach(function (r) {
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
        foSqYouthAct(sv.sel, "promote", function () { sv.xi = null; sv.sel = null; pgSquad(); }, pb);
      });
      var rb0 = page.querySelector("#fo-sqx-release");
      if (rb0) rb0.addEventListener("click", function () {
        foSqYouthAct(sv.sel, "release", function () { sv.xi = null; sv.sel = null; pgSquad(); }, rb0);
      });

      // ==== SQUAD v2 wiring ==================================================
      var s2Repaint = function () {
        var y = window.scrollY; pgSquad();
        try { window.scrollTo(0, y); } catch (eY2) {}
      };
      page.querySelectorAll(".fo-s2-vb").forEach(function (b) {
        b.addEventListener("click", function () {
          sv.view = b.getAttribute("data-view");
          try { localStorage.setItem("fo_sq_view", sv.view); } catch (eV3) {}
          pgSquad();
        });
      });
      var q2 = page.querySelector("#fo-s2-q");
      if (q2) q2.addEventListener("input", function () {
        sv.q = q2.value;
        var y = window.scrollY; pgSquad();
        try {
          window.scrollTo(0, y);
          var q3 = document.querySelector("#fo-s2-q");
          if (q3) { q3.focus(); q3.setSelectionRange(q3.value.length, q3.value.length); }
        } catch (eQ) {}
      });
      var so2 = page.querySelector("#fo-s2-sort");
      if (so2) so2.addEventListener("change", function () { sv.s2sort = so2.value; s2Repaint(); });
      page.querySelectorAll(".fo-s2-chip").forEach(function (b) {
        b.addEventListener("click", function () { sv.roleF = b.getAttribute("data-rf"); s2Repaint(); });
      });
      // a row opens its dossier; the buttons inside act without closing it
      page.querySelectorAll(".fo-s2-row[data-open]").forEach(function (r) {
        r.addEventListener("click", function (ev) {
          if (ev.target.closest("button") || ev.target.closest("a")) return;
          var n = r.getAttribute("data-open");
          sv.open = sv.open === n ? null : n;
          s2Repaint();
        });
      });
      page.querySelectorAll("[data-goman]").forEach(function (b) {
        b.addEventListener("click", function () { location.hash = "#/player?n=" + encodeURIComponent(b.getAttribute("data-goman")); });
      });
      page.querySelectorAll("[data-ypro]").forEach(function (b) {
        b.addEventListener("click", function () {
          foSqYouthAct(b.getAttribute("data-ypro"), "promote", function () { sv.xi = null; sv.open = null; s2Repaint(); }, b);
        });
      });
      page.querySelectorAll("[data-yrel]").forEach(function (b) {
        b.addEventListener("click", function () {
          foSqYouthAct(b.getAttribute("data-yrel"), "release", function () { sv.xi = null; sv.open = null; s2Repaint(); }, b);
        });
      });
      page.querySelectorAll("[data-mkc]").forEach(function (b) {
        b.addEventListener("click", function () {
          var n = b.getAttribute("data-mkc");
          try { App.orders = App.orders || {}; App.orders.captain = n; if (typeof saveGame === "function") saveGame(); } catch (eC2) {}
          try { toast(n + " takes the captaincy."); } catch (eT2) {}
          s2Repaint();
        });
      });
      page.querySelectorAll("[data-mkk]").forEach(function (b) {
        b.addEventListener("click", function () {
          var n = b.getAttribute("data-mkk");
          try { App.orders = App.orders || {}; App.orders.keeper = n; if (typeof saveGame === "function") saveGame(); } catch (eK2) {}
          try { toast(n + " takes the gloves."); } catch (eT3) {}
          s2Repaint();
        });
      });
      // Add / remove: one tap either way. The list may sit at ten while a
      // change is made; nothing reaches the orders until Save First XI.
      page.querySelectorAll("[data-xit]").forEach(function (b) {
        b.addEventListener("click", function () {
          var n = b.getAttribute("data-xit");
          var at2 = sv.xi.indexOf(n);
          if (at2 >= 0) {
            sv.xi.splice(at2, 1);
            sv.xiDirty = 1;
          } else {
            if (sv.xi.length >= 11) {
              try { toast("The XI is full - remove a man first (the ✕ beside his name)."); } catch (eT4) {}
              return;
            }
            sv.xi.push(n);
            sv.xiDirty = 1;
          }
          s2Repaint();
        });
      });
      page.querySelectorAll("[data-xrm]").forEach(function (b) {
        b.addEventListener("click", function () {
          var i4 = parseInt(b.getAttribute("data-xrm"), 10);
          if (i4 >= 0 && i4 < sv.xi.length) { sv.xi.splice(i4, 1); sv.xiDirty = 1; s2Repaint(); }
        });
      });
      // the rail: reorder by drag on desktop, by the little arrows anywhere
      var xiMove = function (from, to) {
        if (from === to || from < 0 || to < 0 || from >= sv.xi.length || to >= sv.xi.length) return;
        var m2 = sv.xi.splice(from, 1)[0];
        sv.xi.splice(to, 0, m2);
        sv.xiDirty = 1;
        s2Repaint();
      };
      page.querySelectorAll(".fo-s2-xirow").forEach(function (r) {
        r.addEventListener("dragstart", function (ev) {
          try { ev.dataTransfer.setData("text/plain", r.getAttribute("data-xi")); ev.dataTransfer.effectAllowed = "move"; } catch (eD) {}
        });
        r.addEventListener("dragover", function (ev) { ev.preventDefault(); r.classList.add("dragover"); });
        r.addEventListener("dragleave", function () { r.classList.remove("dragover"); });
        r.addEventListener("drop", function (ev) {
          ev.preventDefault(); r.classList.remove("dragover");
          var from = -1;
          try { from = parseInt(ev.dataTransfer.getData("text/plain"), 10); } catch (eD2) {}
          xiMove(from, parseInt(r.getAttribute("data-xi"), 10));
        });
      });
      page.querySelectorAll(".fo-s2-xirow [data-up]").forEach(function (b) {
        b.addEventListener("click", function () { var i2 = parseInt(b.getAttribute("data-up"), 10); xiMove(i2, i2 - 1); });
      });
      page.querySelectorAll(".fo-s2-xirow [data-dn]").forEach(function (b) {
        b.addEventListener("click", function () { var i3 = parseInt(b.getAttribute("data-dn"), 10); xiMove(i3, i3 + 1); });
      });
      var fs2 = page.querySelector("#fo-s2-fullstats");
      if (fs2) fs2.addEventListener("click", function () { sv.view = "grid"; try { localStorage.setItem("fo_sq_view", "grid"); } catch (eV4) {} pgSquad(); });
      var sv2 = page.querySelector("#fo-s2-save");
      if (sv2) sv2.addEventListener("click", function () {
        if (sv.xi.length !== 11) {
          try { toast("Name eleven first - " + (11 - sv.xi.length) + " more from the roster."); } catch (eT7) {}
          return;
        }
        try {
          foSqCommitXI(sv.xi);
          App.orders = App.orders || {};
          // THE SAVED ORDER IS THE BATTING ORDER. This list is what the match
          // orders page opens on: batOrder is written from it verbatim, so the
          // card a manager arranged here is the card the orders room shows.
          App.orders.batOrder = sv.xi.slice();
          // the sheet the engine reads always names a captain and a keeper
          if (!App.orders.captain || sv.xi.indexOf(App.orders.captain) < 0)
            App.orders.captain = xi.slice().sort(function (a, b2) { return (b2.capt || 0) - (a.capt || 0); })[0].name;
          if (!App.orders.keeper || sv.xi.indexOf(App.orders.keeper) < 0)
            App.orders.keeper = (xi.filter(function (p) { return p.keeper; })[0] || xi[0]).name;
          if (typeof saveGame === "function") saveGame();
        } catch (eS2) {}
        sv.xiDirty = 0;
        try { toast("First XI saved. This batting order now opens the match orders page."); } catch (eT5) {}
        s2Repaint();
      });
      var sg2 = page.querySelector("#fo-s2-sugg");
      if (sg2) sg2.addEventListener("click", function () {
        try {
          var best = pickXI(t).map(function (p) { return p.name; });
          if (best && best.length === 11) {
            sv.xi = best;
            sv.xiDirty = 1;
            try { toast("The coaches name their strongest available XI - save it to make it stick."); } catch (eT6) {}
          }
        } catch (eSg) {}
        s2Repaint();
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
  // A RED STAR MEANS HE PLAYS FOR HIS COUNTRY. The mark comes from the served
  // national squad and nowhere else, so it appears the morning the selectors
  // first name him and goes the morning they leave him out. Every man on this
  // page belongs to THIS club, so the exact club-and-name lookup is the one to
  // use - two cricketers in a league can share a name and only one is capped.
  function foSqStar(p, big) {
    try {
      var sv = window.__foServed;
      if (!sv || !sv.on() || !window.foNatStar) return "";
      return window.foNatStar(p && p.name, sv.slot(), { big: !!big });
    } catch (e) { return ""; }
  }
  function foSqShortName(n) {
    var parts = String(n || "").trim().split(/\s+/);
    return parts.length > 1 ? (parts[0].charAt(0) + ". " + parts[parts.length - 1]) : (parts[0] || "");
  }
  function foSqNatId(nat) {
    // players carry either a 3-letter code (NED) or a full country name
    // ("Netherlands"), depending on which generator signed them; the value
    // returned here is the actual flag FILENAME in client/art/flags/
    var m = {
      ENG: "eng", AUS: "aus", IND: "ind", RSA: "saf", SA: "saf", NZL: "nz", NZ: "nz",
      WIN: "wi", WI: "wi", IRE: "ire", IRL: "ire", NED: "ned", NL: "ned", PAK: "pak",
      SLK: "sri", SL: "sri", AFG: "afg", ZIM: "zim", BAN: "ban", BGD: "ban", NEP: "nep",
      SCO: "sco", WAL: "wal", KEN: "ken", USA: "usa", CAN: "can", NAM: "nam", OMA: "oma", UAE: "uae",
      "ENGLAND": "eng", "AUSTRALIA": "aus", "INDIA": "ind", "SOUTH AFRICA": "saf",
      "NEW ZEALAND": "nz", "WEST INDIES": "wi", "IRELAND": "ire", "NETHERLANDS": "ned",
      "PAKISTAN": "pak", "SRI LANKA": "sri", "AFGHANISTAN": "afg", "ZIMBABWE": "zim",
      "BANGLADESH": "ban", "NEPAL": "nep", "SCOTLAND": "sco", "WALES": "wal", "KENYA": "ken",
      "UNITED STATES": "usa", "USA": "usa", "CANADA": "can", "NAMIBIA": "nam", "OMAN": "oma",
      "UNITED ARAB EMIRATES": "uae", "TRINIDAD & TOBAGO": "wi", "TRINIDAD AND TOBAGO": "wi"
    };
    var k = String(nat || "").trim().toUpperCase();
    return m[k] || String(nat || "").trim().toLowerCase();
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
  // The next-match strip used to sit under the masthead here. The squad page is
  // for judging the men, not for navigating to the fixture - the fixture list,
  // the match centre and every preview already carry that line.
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
      ".fo-lab-head h2{margin:0;font-size:22px;color:#14243A}" +
      ".fo-lab-head .fo-lab-note{color:#9FB0C6;font-size:12.5px}" +
      ".fo-lab-head .fo-lab-acts{margin-left:auto;display:flex;gap:8px}" +
      ".fo-lab-btn{border:1px solid rgba(28,36,51,.2);background:#FFFEFC;color:#14243A;border-radius:9px;padding:8px 14px;font-size:12.5px;font-weight:700;cursor:pointer}" +
      "html body.ftpskin button.fo-lab-btn{background:#FFFEFC !important;color:#14243A !important;border-color:rgba(28,36,51,.2) !important}" +
      "html body.ftpskin button.fo-lab-btn.on{background:#14243A !important;color:#fff !important}" +
      ".fo-lab-chips{display:flex;gap:7px;flex-wrap:wrap;margin:10px 0}" +
      ".fo-lab-chip{border:1px solid rgba(28,36,51,.14);border-radius:999px;padding:6px 13px;font-size:12px;font-weight:700;color:#3a4353;background:#FFFEFC;cursor:pointer;box-shadow:0 1px 3px rgba(7,22,46,.05);transition:border-color .12s ease,color .12s ease}" +
      ".fo-lab-chip:hover{border-color:#C9571F;color:#C9571F}" +
      ".fo-lab-adv{background:#FFFEFC;border:1px solid rgba(28,36,51,.1);border-radius:12px;padding:14px 16px 12px;margin:10px 0 0;display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px 14px;align-items:end;box-shadow:0 2px 10px rgba(7,22,46,.04)}" +
      ".fo-lab-adv .fo-nc label{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
      ".fo-lab-adv select,.fo-lab-adv input{height:36px;box-sizing:border-box}" +
      ".fo-lab-advnote{font-size:11.5px;color:#9FB0C6;margin:6px 2px 10px}" +
      ".fo-lab-actions{display:flex;gap:10px;margin:14px 0;flex-wrap:wrap}" +
      ".fo-lab-actions .fo-lab-go{border:1px solid rgba(28,36,51,.2);background:#FFFEFC;color:#14243A;border-radius:10px;padding:11px 18px;font-size:13.5px;font-weight:800;cursor:pointer}" +
      ".fo-lab-actions .fo-lab-go.primary{background:#C9571F;border-color:#C9571F;color:#FFFEFC}" +
      "html body.ftpskin button.fo-lab-go{background:#FFFEFC !important;color:#14243A !important;border-color:rgba(28,36,51,.2) !important}" +
      "html body.ftpskin button.fo-lab-go.primary{background:#C9571F !important;border-color:#C9571F !important;color:#FFFEFC !important}" +
      ".fo-lab-sweeph{font-size:13px;font-weight:800;color:#14243A;margin:14px 0 8px}" +
      ".fo-lab-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}" +
      ".fo-lab-card{background:#FFFEFC;border:1px solid rgba(28,36,51,.1);border-radius:12px;padding:15px 17px;cursor:pointer;transition:box-shadow .12s ease,border-color .12s ease;box-shadow:0 2px 10px rgba(7,22,46,.04)}" +
      ".fo-lab-card:hover{box-shadow:0 3px 14px rgba(7,22,46,.1)}" +
      ".fo-lab-card.on{border-color:#C9571F;box-shadow:0 0 0 2px rgba(201,85,50,.25)}" +
      ".fo-lab-card h5{margin:0 0 6px;font-size:12px;letter-spacing:.05em;text-transform:uppercase;color:#9FB0C6}" +
      ".fo-lab-rpo{font-size:27px;font-weight:800;color:#14243A;letter-spacing:-.01em}.fo-lab-rpo i{font-style:normal;font-size:12px;color:#9FB0C6;font-weight:600;margin-left:4px}" +
      ".fo-lab-sub{font-size:12px;color:#6A6354;margin-top:5px;line-height:1.5}" +
      ".fo-lab-read{background:#F0F4F8;border:1px solid rgba(31,78,107,.18);border-radius:12px;padding:14px 16px;margin:12px 0;font-size:13.5px;line-height:1.6;color:#243244}" +
      ".fo-lab-read b{color:#14243A}" +
      ".fo-lab-read .fo-lab-apply{margin-top:10px;display:flex;gap:8px;align-items:center;flex-wrap:wrap}" +
      ".fo-lab-hon{font-size:11.5px;color:#9FB0C6;margin:6px 2px 14px}" +
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

  var FO_LAB_COL = { dot: "#9aa3b2", "1": "#7cb87c", "2": "#5aa05a", "3": "#3f8f3f", "4": "#22635F", "6": "#1c5537", wicket: "#B23230", extras: "#C08A2E" };
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
