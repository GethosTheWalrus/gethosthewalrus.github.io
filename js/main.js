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
            strings: ["ls ~/career-highlights/"],
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
            strings: ["cat ~/professional-summary.txt"],
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

        // document.querySelector("#summary").innerHTML = "I am a software and network engineering professional with experience in leading, developing, and individually contributing to engineering programs, teams, and products. I have extensive experience with agile methodologies and managing teams comprised of talent of varying experience levels, including other leaders. I also have experience leading cross functional teams across different job families such as software engineering, dev ops/SRE, quality assurance, and network engineering.";

        document.querySelector("#summary").innerHTML = "Accomplished engineering leader with 10+ years of experience delivering high-performing solutions. Skilled in leading diverse, cross-functional teams (including engineers, DevOps, QA, and product) to achieve ambitious goals. Proven track record of reducing defects by up to 70% through the implementation of agile methodologies. Eager to leverage my proven technical expertise and leadership to contribute to your team's success.";

        // document.querySelector("#badge").innerHTML = "<div id='certificates'><a target='_blank' href='https://bcert.me/splcelejy'><img style='width:100px;' alt='CSM' src='img/badge-7227 (1).png' /></a></div>";

        document.querySelector("#social").innerHTML = `<a title="Resume" target="_blank" href="files/Mike_Toscano_Engineering_Leader.pdf"><span class="social flex5 grow fa fa-file-pdf"></span></a>
                <a target="_blank" href="https://www.linkedin.com/in/michael-toscano/"><span class="social flex5 grow fab fa-linkedin"></span></a>
                <a target="_blank" href="https://github.com/GethosTheWalrus"><span class="social flex5 grow fab fa-github"></span></a>
                <a target="_blank" href="https://stackoverflow.com/users/1717357/mike"><span class="social flex5 grow fab fa-stack-overflow"></span></a>
                <a target="_blank" href="https://www.youtube.com/@CaptainMikeCodes/videos"><span class="social flex5 grow fab fa-youtube"></span></a>`;

        document.querySelector("#finalline").style.display = 'block';

    }, 500);

}