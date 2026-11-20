from pathlib import Path
from html import escape
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph, Table, TableStyle, Spacer

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT/'output'/'pdf'
OUT.mkdir(parents=True,exist_ok=True)
PDF = OUT/'os_exam_practice_questions_and_answers.pdf'
pdfmetrics.registerFont(TTFont('Arial',r'C:\Windows\Fonts\arial.ttf'))
pdfmetrics.registerFont(TTFont('Arial-Bold',r'C:\Windows\Fonts\arialbd.ttf'))
pdfmetrics.registerFontFamily('Arial',normal='Arial',bold='Arial-Bold',italic='Arial',boldItalic='Arial-Bold')
NAVY=colors.HexColor('#162B3C')
TEAL=colors.HexColor('#096B70')
INK=colors.HexColor('#17212A')
GRAY=colors.HexColor('#53616A')
RULE=colors.HexColor('#C8D0D5')
PALE=colors.HexColor('#F0F4F5')

def q(n,question,answer,ref,table=None):
    return {'n':n,'q':question,'a':answer,'ref':ref,'table':table}

PAGES=[
('Memory and paging',[
q(1,'Distinguish internal and external fragmentation. For free holes of 100, 500, 200, 300 and 600 KiB (in address order), which hole does each fit policy choose for a 212 KiB request?',
  '<b>Internal:</b> unused space inside an allocated unit. <b>External:</b> free space split across holes, preventing a sufficiently large contiguous allocation. First fit chooses <b>500 KiB</b>; best fit <b>300 KiB</b>; worst fit <b>600 KiB</b>. Treat each policy independently. Paging eliminates external fragmentation of physical-frame allocation, but can waste space in a final page.',
  'T5 PDF 20-28'),
q(2,'With 4 KiB pages, virtual address 0x2F3A maps to physical frame 0x19. Find the VPN, offset and physical address.',
  '4 KiB = 2<super>12</super> bytes, so the offset uses 12 bits (the last three hex digits). <b>VPN = 0x2; offset = 0xF3A.</b> PA = 0x19 × 0x1000 + 0xF3A = <b>0x19F3A</b>. Replace the virtual page number with the frame number; preserve the offset.',
  'T5 PDF 30-37'),
q(3,'For 32-bit virtual addresses, 4 KiB pages and 4-byte PTEs, calculate flat page-table size and the two-level address split. Why can two levels save memory?',
  'Offset = 12 bits; VPN = 20 bits. Entries = 2<super>20</super>; size = 2<super>20</super> × 4 B = <b>4 MiB per process</b>. A 4 KiB table page holds 1024 = 2<super>10</super> entries. Split: <b>10 outer | 10 inner | 12 offset bits</b>. Unused virtual regions need no lower-level tables, saving memory for sparse address spaces.',
  'T5 PDF 39; T6A PDF 11-20'),
q(4,'Does every TLB miss cause a page fault? Explain what happens if the page is resident.',
  '<b>No.</b> A TLB miss means the translation is absent from the translation cache. The MMU walks the page table; a resident, permitted mapping supplies the frame and refills the TLB. A nonresident page causes a fault; an illegal access or protection violation can also fault. <b>Missing translation in the TLB and missing page in RAM are different conditions.</b>',
  'T5 PDF 39-42; T6A PDF 3-7; T6B PDF 19-29'),
q(5,'A process accesses a legal page on disk. RAM is full and the chosen victim is dirty. Describe the complete handling sequence and process-state changes.',
  'Trap into the kernel and save execution state. Validate the address/access and locate backing data. Select a victim; preserve dirty contents on disk and invalidate its old PTE/TLB mapping before reusing the frame. Load the requested page. During disk I/O, the process goes <b>Running → Blocked</b> and another may run. Completion lets the OS update mappings and make it <b>Blocked → Ready</b>. When scheduled: <b>Ready → Running</b>; restore state, return to user mode and <b>retry the faulting instruction</b>.',
  'T6B PDF 27-34; T7A PDF 4-7'),
q(6,'After fork(), the child first writes to a page shared through copy-on-write. What happens, and why use this scheme?',
  'Separate address spaces initially map the same read-only frame. The write causes a protection fault. The OS recognizes COW, allocates a frame, copies contents, changes the child’s PTE to the private writable copy, invalidates the stale TLB entry and retries the write. The parent retains its original mapping/content. <b>Only modified pages are copied</b>, reducing process-creation work.',
  'T6B PDF 2-7'),
]),
('Replacement and memory performance',[
q(7,'Trace FIFO, LRU and OPT for 1,2,3,1,4,1,2,5,1,2 using three initially empty frames. Show the frame contents after each reference and count faults.',
  '<b>FIFO = 7; LRU = 6; OPT = 5 faults.</b> F = fault; H = hit. Fixed frame slots are shown. FIFO hits do not change insertion order; LRU hits update recency. OPT removes the page whose next use is farthest away. Ties may give other optimal arrangements with the same fault count.',
  'T7A PDF 8-20; new practice trace',
  (['Ref','FIFO frames','LRU frames','OPT frames'],[
   ['1','1, -, -   F','1, -, -   F','1, -, -   F'],
   ['2','1, 2, -   F','1, 2, -   F','1, 2, -   F'],
   ['3','1, 2, 3   F','1, 2, 3   F','1, 2, 3   F'],
   ['1','1, 2, 3   H','1, 2, 3   H','1, 2, 3   H'],
   ['4','4, 2, 3   F','1, 4, 3   F','1, 2, 4   F'],
   ['1','4, 1, 3   F','1, 4, 3   H','1, 2, 4   H'],
   ['2','4, 1, 2   F','1, 4, 2   F','1, 2, 4   H'],
   ['5','5, 1, 2   F','1, 5, 2   F','1, 2, 5   F'],
   ['1','5, 1, 2   H','1, 5, 2   H','1, 2, 5   H'],
   ['2','5, 1, 2   H','1, 5, 2   H','1, 2, 5   H'],
  ],[0.10,0.30,0.30,0.30])),
q(8,'Clock has frames [A,B,C], reference bits [1,0,1], and its hand at A. D faults. Which page is evicted, what changes, and where is the hand next?',
  'Clear A’s reference bit and advance. B has R=0, so <b>evict B</b>. Load D in B’s slot with R=1 for the current reference, then advance the hand to C. Final frames <b>[A,D,C]</b>, bits <b>[0,1,1]</b>. The reference bit tracks use; the dirty bit tracks modification.',
  'T7B PDF 3-10'),
q(9,'Can adding a physical frame increase page faults? Give an example and name policies that avoid this effect.',
  '<b>FIFO can exhibit Belady’s anomaly.</b> For 1,2,3,4,1,2,5,1,2,3,4,5, it produces <b>9 faults with 3 frames and 10 with 4</b>. Its eviction history changes with the frame count. LRU and OPT have the stack property and do not exhibit this anomaly.',
  'T7A PDF 11-17'),
q(10,'Three processes need working sets of 3, 4 and 5 pages, but only 10 frames exist. Explain the likely problem, a remedy, and local versus global replacement.',
  'D = 3 + 4 + 5 = <b>12 &gt; 10</b>: thrashing is likely because needed pages are repeatedly evicted/reloaded. Suspend a process or add RAM; suspending the 5-page process reduces demand to 7. Global replacement can take another process’s frames; local replacement uses only the process’s own frames. Local replacement limits interference but does not supply missing capacity.',
  'T7B PDF 16-29'),
q(11,'Normal access takes 200 ns. A page fault takes 8 ms in total and occurs once per 1,000 accesses. Find effective access time and approximate slowdown.',
  'p = 0.001; F = 8,000,000 ns. EAT = (1 − p)M + pF = 0.999(200) + 0.001(8,000,000) = <b>8199.8 ns ≈ 8.2 µs</b>. Slowdown = 8199.8 / 200 ≈ <b>41×</b>. A small fault rate is expensive because disk-based fault service is much slower than RAM access.',
  'T6B PDF 34-35'),
]),
('Disks, RAID and file identity',[
q(12,'A 10,000-RPM HDD has 4 ms average seek, 0.2 ms controller overhead and a transfer rate of 100,000,000 B/s. Estimate a random 8 KiB read, excluding queueing.',
  'Average rotation = 30,000/RPM = <b>3 ms</b>. Transfer = 8192/100,000,000 s = <b>0.08192 ms</b>. Total = 4 + 3 + 0.2 + 0.08192 = <b>7.28192 ms ≈ 7.282 ms</b>. Seek and rotation dominate this small random request. Keep bytes/bits and seconds/milliseconds consistent.',
  'T8 PDF 7-9'),
q(13,'What is the difference between NAS and SAN? Where does iSCSI fit?',
  '<b>NAS exports files/directories</b> over a network, typically with NFS or CIFS/SMB. <b>SAN presents block storage</b> to hosts, often through a separate storage fabric. iSCSI carries SCSI commands over IP and provides remote block access. The essential distinction is the interface: files versus blocks.',
  'T9 PDF 2-8'),
q(14,'Six equal 2 TB disks are available. Give usable capacity for RAID 5, RAID 6 and RAID 10. RAID 10 pairs are (A,B), (C,D), (E,F): compare losing A+C with losing A+B.',
  '<b>RAID 5: (6 − 1) × 2 = 10 TB.</b> RAID 6: (6 − 2) × 2 = <b>8 TB</b>. RAID 10: (6 × 2)/2 = <b>6 TB</b>. A+C survives because each affected pair still has a copy. A+B loses data because both copies in one pair are gone. RAID 5 survives any one disk loss; RAID 6 any two.',
  'T9 PDF 13-21; parity addendum PDF 5-8'),
q(15,'Data blocks are 1101, 0110 and 1010. Calculate XOR parity and reconstruct the second block after it becomes unreadable. Can ordinary parity locate an arbitrary flipped bit?',
  'P = 1101 XOR 0110 XOR 1010 = <b>0001</b>. Missing D2 = P XOR D1 XOR D3 = 0001 XOR 1101 XOR 1010 = <b>0110</b>. Ordinary parity detects odd numbers of bit flips but cannot identify which bit changed; even numbers can escape. Reconstruction assumes a <b>known missing/unreadable block</b>, usually identified by disk error reporting.',
  'Parity addendum PDF 3-7'),
q(16,'Why does RAID 5 distribute parity? Why do small writes cost more than a single disk write? How does RAID 6 differ?',
  'Rotating parity avoids a single dedicated parity-disk bottleneck. A typical RAID 5 read-modify-write uses <b>4 operations</b>: read old data and parity, then write new data and parity. RAID 6 maintains two independent codes, P and Q, and typically uses <b>6 operations</b>. Q is not a duplicate XOR code; it permits recovery from two disk failures.',
  'T9 PDF 20-21; parity addendum PDF 5-8'),
q(17,'A file contains ABCDEFGH. Compare (a) two separate open() calls followed by read(a,2), read(b,2), and (b) one open() followed by fork(), with the parent reading two bytes before the child. Assume successful full reads and no other I/O.',
  '<b>(a)</b> Both read <b>AB</b>; each open creates an independent open-file entry/offset. <b>(b)</b> Parent reads <b>AB</b>, then child reads <b>CD</b>; inherited descriptors refer to the same open-file entry and share its offset. The FD is a process-local integer; the open-file entry stores the current offset; the inode stores persistent metadata and block locations.',
  'T10 PDF 4, 9, 11-14'),
]),
('Names, durability and file-system internals',[
q(18,'Compare a hard link and a symbolic link. What happens when one hard-link name of a regular file is unlinked while that file is still open?',
  'A hard link is another name for the <b>same inode</b> on the same filesystem. A symbolic link has its own inode containing a target path; it can cross filesystems and dangle. unlink() removes one directory entry and decrements link count. Other hard links remain valid. Storage is reclaimed only when <b>no hard links and no open references remain</b>.',
  'T10 PDF 20-22'),
q(19,'Explain permission 755. For a directory, how do read and execute differ? Can a user traverse a directory without listing all names?',
  '<b>755 = rwxr-xr-x:</b> owner gets rwx; group and others get r-x. Directory read permits listing names; execute permits searching/traversing entries. <b>Yes:</b> execute without read allows access by a known name, subject to all remaining path and target permissions. Directory write controls changing entries and normally also requires execute.',
  'T10 PDF 23-24'),
q(20,'write() has returned successfully. Is the file guaranteed to survive power loss? Explain fsync() and the temporary-file/rename replacement pattern.',
  '<b>No:</b> data may remain in dirty RAM buffers. fsync(fd) requests persistence. To replace a file: write a temporary file → fsync(temp) → close → rename(temp,target) → fsync(containing directory), assuming a same-filesystem rename. Rename changes the visible name atomically, while syncing file and directory addresses crash durability. <b>Atomicity and durability are different guarantees.</b>',
  'T10 PDF 15-17; T11 PDF 23-25'),
q(21,'The inode table starts at block 3. Blocks are 4096 B and inodes 256 B, numbered from zero. Locate inode 35. How many inodes fit in five inode-table blocks?',
  '16 inodes/block. Block = 3 + floor(35 × 256 / 4096) = <b>5</b>. Offset inside block = (35 × 256) mod 4096 = <b>768 B</b>. Five table blocks hold 5 × 4096/256 = <b>80 inodes</b>. This is not a guarantee of 80 user files: directories consume inodes, and data capacity is limited too.',
  'T11 PDF 9-12'),
q(22,'An inode has 12 direct pointers and a single-indirect pointer. Blocks are 4 KiB and pointers are 4 B. What data capacity can it address? What does a double-indirect pointer add?',
  'An indirect block holds 4096/4 = <b>1024 pointers</b>. Direct + single-indirect capacity = (12 + 1024) × 4096 = <b>4,243,456 B = 4 MiB + 48 KiB</b>. A double-indirect pointer adds 1024² data blocks = <b>4 GiB</b>. These are data capacities; indirect pointer blocks require additional storage.',
  'T11 PDF 13-15'),
q(23,'In the simple cold-cache model, what must be read to open /foo/bar? Does reading existing file data require reading the allocation bitmap?',
  '<b>Root inode → root directory data → foo inode → foo directory data → bar inode:</b> five reads, assuming one block for each and no cached metadata. Existing data is found through the inode and any required indirect blocks; <b>no allocation-bitmap lookup is needed</b>. Warm cache state reduces physical reads.',
  'T11 PDF 16-18, 23'),
q(24,'In the slides’ uncached model, creation costs 10 logical I/Os and each allocating write costs five. What is the total for create plus three new blocks, and which five I/Os make up one allocating write?',
  'Total = 10 + 3 × 5 = <b>25 logical I/Os</b>. One allocating write: <b>read data bitmap; write data bitmap; read inode; write inode; write new data block</b>. Caching and batching can reduce actual disk work. These are the stated model’s counts; extra directory growth or indirect blocks can change the cost.',
  'T11 PDF 19-25'),
]),
]

W,H=612,792
M=36
WIDTH=W-2*M
TOP=690
BOTTOM=42

def flows(items,fs):
    qs=ParagraphStyle('question',fontName='Arial-Bold',fontSize=fs+0.35,leading=fs*1.22,textColor=NAVY,spaceAfter=4)
    ans=ParagraphStyle('answer',fontName='Arial',fontSize=fs,leading=fs*1.24,textColor=INK,spaceAfter=3)
    refs=ParagraphStyle('refs',fontName='Arial',fontSize=7,leading=8,textColor=GRAY,spaceAfter=8)
    cell=ParagraphStyle('cell',parent=ans,fontSize=fs-0.3,leading=fs*1.16,spaceAfter=0)
    out=[]
    for item in items:
        out.append(Paragraph(str(item['n'])+'. '+item['q'],qs))
        if item['table']:
            heads,rows,widths=item['table']
            data=[[Paragraph('<b>'+h+'</b>',cell) for h in heads]]+[[Paragraph(escape(v),cell) for v in row] for row in rows]
            t=Table(data,colWidths=[WIDTH*w for w in widths])
            t.setStyle(TableStyle([('VALIGN',(0,0),(-1,-1),'TOP'),('BACKGROUND',(0,0),(-1,0),PALE),('LINEBELOW',(0,0),(-1,0),0.6,RULE),('LINEBELOW',(0,1),(-1,-1),0.3,RULE),('TOPPADDING',(0,0),(-1,-1),2.5),('BOTTOMPADDING',(0,0),(-1,-1),2.5),('LEFTPADDING',(0,0),(-1,-1),6),('RIGHTPADDING',(0,0),(-1,-1),6)]))
            out.extend([t,Spacer(1,6)])
        out.append(Paragraph('<b>Answer:</b> '+item['a'],ans))
        out.append(Paragraph('Source: '+item['ref']+'.',refs))
    return out

def height(items,fs):
    return sum(f.wrap(WIDTH,10000)[1]+f.getSpaceBefore()+f.getSpaceAfter() for f in flows(items,fs))

fs=10.2
while max(height(items,fs) for _,items in PAGES)>TOP-BOTTOM and fs>9.0:
    fs=round(fs-0.05,2)
heights=[round(height(items,fs),1) for _,items in PAGES]
assert max(heights)<=TOP-BOTTOM,(fs,heights)
print('Font size',fs,'heights',heights,'available',TOP-BOTTOM)

c=canvas.Canvas(str(PDF),pagesize=(W,H),pageCompression=1)
c.setTitle('Operating Systems - 24 Practice Questions and Model Answers')
c.setAuthor('Prepared from supplied CSCE 410 slides')
c.setSubject('Practice for Topics 5-10 and Topic 11 PDF pages 1-26')
for page,(title,items) in enumerate(PAGES,1):
    c.setFillColor(NAVY);c.setFont('Arial-Bold',18)
    c.drawString(M,754,'CSCE 410 / Practice questions')
    c.setFont('Arial-Bold',9);c.drawRightString(W-M,757,f'{page} / {len(PAGES)}')
    c.setFillColor(INK);c.setFont('Arial',8)
    c.drawString(M,737,'Topics 5-10 + RAID parity addendum; Topic 11 through PDF page 26 (recap).')
    c.setFont('Arial',8);c.drawString(M,725,'Plausible practice based on your slides and prior test style. Cover answers before trying each question.')
    c.setStrokeColor(NAVY);c.setLineWidth(0.8);c.line(M,716,W-M,716)
    c.setFillColor(TEAL);c.setFont('Arial-Bold',12);c.drawString(M,699,title)
    y=TOP
    for f in flows(items,fs):
        y-=f.getSpaceBefore();_,fh=f.wrap(WIDTH,10000);f.drawOn(c,M,y-fh);y-=fh+f.getSpaceAfter()
    assert y>=BOTTOM-0.1,(page,y)
    c.setStrokeColor(RULE);c.setLineWidth(0.4);c.line(M,33,W-M,33)
    c.setFont('Arial',7);c.setFillColor(GRAY)
    c.drawString(M,21,'References use supplied topic names and PDF page indices. T6A/B and T7A/B identify the Part A/B decks.')
    c.drawRightString(W-M,10,'KiB = 1024 B; MiB = 1024 KiB; GiB = 1024 MiB. Show assumptions and units.')
    c.showPage()
c.save()
print(PDF)
