// 日本国内で公開されているGTFS-JPフィードの一部を、URLを自分で探さなくても
// 選べるようにあらかじめ用意したもの。網羅的ではないため、リストにない事業者は
// 引き続きURLを直接入力できるようにしておく。
export interface KnownGtfsFeed {
  region: string;
  name: string;
  sourceUrl: string;
}

export const KNOWN_GTFS_FEEDS: KnownGtfsFeed[] = [
  // 広島県 (広島県バス協会 GTFSオープンデータサイトより)
  { region: "広島県", name: "広島電鉄", sourceUrl: "https://ajt-mobusta-gtfs.mcapps.jp/static/8/current_data.zip" },
  { region: "広島県", name: "広島バス", sourceUrl: "https://ajt-mobusta-gtfs.mcapps.jp/static/9/current_data.zip" },
  { region: "広島県", name: "広島交通", sourceUrl: "https://ajt-mobusta-gtfs.mcapps.jp/static/10/current_data.zip" },
  { region: "広島県", name: "芸陽バス", sourceUrl: "https://ajt-mobusta-gtfs.mcapps.jp/static/11/current_data.zip" },
  { region: "広島県", name: "備北交通", sourceUrl: "https://ajt-mobusta-gtfs.mcapps.jp/static/12/current_data.zip" },
  { region: "広島県", name: "エイチ・ディー西広島", sourceUrl: "https://ajt-mobusta-gtfs.mcapps.jp/static/13/current_data.zip" },
  { region: "広島県", name: "フォーブル", sourceUrl: "https://ajt-mobusta-gtfs.mcapps.jp/static/14/current_data.zip" },
  { region: "広島県", name: "JRバス中国", sourceUrl: "https://ajt-mobusta-gtfs.mcapps.jp/static/15/current_data.zip" },
  { region: "広島県", name: "ささき観光（おおのハートバス）", sourceUrl: "https://ajt-mobusta-gtfs.mcapps.jp/static/17/current_data.zip" },
  { region: "広島県", name: "呉市生活バス", sourceUrl: "https://ajt-mobusta-gtfs.mcapps.jp/static/18/current_data.zip" },
  { region: "広島県", name: "廿日市市自主運行バス", sourceUrl: "https://ajt-mobusta-gtfs.mcapps.jp/static/19/current_data.zip" },
  { region: "広島県", name: "おのみちバス", sourceUrl: "https://ajt-mobusta-gtfs.mcapps.jp/static/53/current_data.zip" },
  { region: "広島県", name: "朝日交通（阿戸熊野線）", sourceUrl: "https://ajt-mobusta-gtfs.mcapps.jp/static/54/current_data.zip" },
  { region: "広島県", name: "江田島バス", sourceUrl: "https://gtfs-st.busit.jp/api/etajimabus" },
  { region: "広島県", name: "中国バス", sourceUrl: "https://bus-vision.jp/gtfs_v2/chugokubus/gtfsFeed" },
  { region: "広島県", name: "鞆鉄道", sourceUrl: "https://bus-vision.jp/gtfs_v2/tomotetsubus/gtfsFeed" },
  { region: "広島県", name: "井笠バスカンパニー", sourceUrl: "https://bus-vision.jp/gtfs_v2/ikasabus/gtfsFeed" },

  // 香川県
  { region: "香川県", name: "ことでん（鉄道）", sourceUrl: "http://www.kotoden.co.jp/gtfsdata/gtfs_kd.zip" },
  { region: "香川県", name: "ことでんバス", sourceUrl: "http://www.kotoden.co.jp/gtfsdata/latest/gtfs_kb.zip" },
];
