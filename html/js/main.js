document.addEventListener('DOMContentLoaded', (event) => {

    typeLs();

})

function showTab(self, tab) {

    for (let el of document.querySelectorAll('.screen')) el.classList.remove('active');
    for (let el of document.querySelectorAll('.tab')) el.classList.remove('active');

    self.classList.add('active');

    console.log('#' + tab);
    document.querySelector('#' + tab).classList.add('active');

}

function typeLs() {

    setTimeout(function() {

        var typed = new Typed('#ls', {
            strings: ["ls"],
            typeSpeed: 40,
            showCursor: false,
            onComplete: function() { typeFolders(); }
        });

    }, 1000);

}

function typeFolders() {

    setTimeout(function() {

        document.querySelector("#folders").style.display = 'flex';
        document.querySelector("#catline").style.display = 'block';

        typeCat();

    }, 500);

}

function typeExperienceFolder() {

    setTimeout(function() {

        var typed = new Typed('#experiencefolder', {
            strings: ["experience"],
            typeSpeed: 5,
            onComplete: function() { typeSkillsFolder(); }
        });

    }, 1000);

}

function typeSkillsFolder() {

    setTimeout(function() {

        var typed = new Typed('#skillsfolder', {
            strings: ["skills"],
            typeSpeed: 5,
            onComplete: function() { typeSummaryTxt(); }
        });

    }, 0);

}

function typeSummaryTxt() {

    setTimeout(function() {

        var typed = new Typed('#summarytxt', {
            strings: ["summary.txt"],
            typeSpeed: 5,
            onComplete: function() { typeCat(); }
        });

    }, 0);

}

function typeCat() {

    setTimeout(function() {

        var typed = new Typed('#cat', {
            strings: ["cat summary.txt"],
            typeSpeed: 40,
            showCursor: false,
            onComplete: function() { typeSummary(); }
        });

    }, 1000);

}

function typeSummary() {

    setTimeout(function() {

        // var typed = new Typed('.summary', {
        //     strings: ["I am an IT and software development professional with 6+ years of professional experience in developing and maintaining client-facing systems and the teams that make them possible. My goal as an IT professional is to enrich as many people's lives as possible through the products and services that my team and I create."],
        //     typeSpeed: 1,
        //     onComplete: function() { console.log("complete"); }
        // });

        document.querySelector("#summary").innerHTML = "I am a software and network engineering professional with experience in leading, developing, and individually contributing to engineering programs, teams, and products. I have extensive experience with agile methodologies and managing teams comprised of talent of varying experience levels, including other leaders. I also have experience leading cross functional teams across different job families such as software engineering, dev ops/SRE, quality assurance, and network engineering.";

        document.querySelector("#badge").innerHTML = "<div id='certificates'><a target='_blank' href='https://bcert.me/splcelejy'><img style='width:100px;' alt='CSM' src='img/badge-7227 (1).png' /></a></div>";

        document.querySelector("#finalline").style.display = 'block';

    }, 500);

}