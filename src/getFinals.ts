import fetch from "node-fetch";

interface ExamAPI {
    rows: number;
    output: ExamInfoAPI[];
}

interface ExamInfoAPI {
    type: string;
    course: string;
    day: string;
    time: string;
    building: string;
    rooms: string;
    comments: string;
}

export class ExamInfo {
    public courseDept: string;
    public courseNum: string;
    public courseId: Set<string>;
    public courseTime: string;
    public finalStart: string;
    public finalEnd: string;
    public finalLocations: string[];
    public comments: string;
}

export async function getFinals(): Promise<ExamInfo[]> {
    const examData: ExamAPI = await (await fetch("https://registrar.uic.edu/assets/scripts/finals-initial-query.php?term=220191")).json();
    
    let divArray: ExamInfo[] = [];
    divArray = examData.output.map((element: ExamInfoAPI): ExamInfo => {
        let examInfo = new ExamInfo();

        examInfo.courseDept         = element.course.split(" ")[0];
        examInfo.courseNum          = element.course.split(" ")[1];
        examInfo.courseId           = new Set().add(element.course.split(" ")[3].split("<br/>")[0]);
        examInfo.courseTime         = element.course.split(" ")[3].split("<br/>")[1] + element.course.split(" ").slice(4).join(" ");
        examInfo.finalLocations     = element.rooms.split(", ");
        examInfo.comments           = element.comments;

        try {
            examInfo.finalStart     = new Date(element.day + " 2019 " + element.time.split(" ")[0] + " " + element.time.split(" ")[3] + " CST").toISOString();
        }
        catch(err) {
            console.error(err);
            console.log(element.day + " 2019 " + element.time.split(" ")[0] + " " + element.time.split(" ")[3] + " CST");
            console.error(examInfo);
        }
        try {
            examInfo.finalEnd       = new Date(element.day + " 2019 " + element.time.split(" ")[2] + " " + element.time.split(" ")[3] + " CST").toISOString();
        }
        catch(err) {
            console.error(err);
            console.log(element.day + " 2019 " + element.time.split(" ")[2] + " " + element.time.split(" ")[3] + " CST");
            console.error(examInfo);
        }
        return examInfo;
    });

    return divArray;
}

getFinals().then(data => console.log(data));
// getFinals();