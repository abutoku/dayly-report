import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const sampleReports = [
  {
    date: "2026/04/04",
    salesperson: "田中太郎",
    visits: 3,
    status: "提出済",
  },
  {
    date: "2026/04/03",
    salesperson: "田中太郎",
    visits: 2,
    status: "提出済",
  },
  {
    date: "2026/04/02",
    salesperson: "田中太郎",
    visits: 1,
    status: "下書き",
  },
];

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 p-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          営業日報システム
        </h1>
        <p className="text-muted-foreground text-sm">
          shadcn/ui セットアップ確認用のデモページです。実際の画面は SCR-001 〜
          SCR-031 で順次実装します。
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>ログインフォーム デモ</CardTitle>
          <CardDescription>
            shadcn/ui の Input / Label / Button を使った最小フォーム
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">メールアドレス</Label>
            <Input id="email" type="email" placeholder="tanaka@example.com" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="password">パスワード</Label>
            <Input id="password" type="password" placeholder="••••••••" />
          </div>
        </CardContent>
        <CardFooter className="justify-end gap-2">
          <Button variant="outline">キャンセル</Button>
          <Button>ログイン</Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>日報一覧 デモ</CardTitle>
          <CardDescription>
            shadcn/ui の Table を使った一覧表示サンプル
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>報告日</TableHead>
                <TableHead>担当者</TableHead>
                <TableHead className="text-right">訪問件数</TableHead>
                <TableHead>ステータス</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sampleReports.map((report) => (
                <TableRow key={report.date}>
                  <TableCell className="font-medium">{report.date}</TableCell>
                  <TableCell>{report.salesperson}</TableCell>
                  <TableCell className="text-right">{report.visits}</TableCell>
                  <TableCell>{report.status}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Problem / Plan デモ</CardTitle>
          <CardDescription>
            shadcn/ui の Textarea を使ったテキスト入力サンプル
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="problem">Problem（課題・相談）</Label>
            <Textarea
              id="problem"
              placeholder="本日の課題や相談事項を入力してください"
              rows={3}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="plan">Plan（明日やること）</Label>
            <Textarea
              id="plan"
              placeholder="明日の予定を入力してください"
              rows={3}
            />
          </div>
        </CardContent>
        <CardFooter className="justify-end gap-2">
          <Button variant="outline">下書き保存</Button>
          <Button>提出</Button>
        </CardFooter>
      </Card>
    </main>
  );
}
