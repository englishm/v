var tokens,lex,isNum,parse,expr,exprs,wraps,eval,evals,evall,evalSeq,eof=-1,log=console.log,json=JSON.stringify,spy=function(v){log(v);return v},error=function(m){throw m},bl=function(x){return x&1},pt,to=function(t,x){return typeof x==t},sl=function(a,n){return Array.prototype.slice.call(a,n)},inval,invals,arit,vdo,reduce,map,take,drop,concat,reverse,udf=void 0,N=null;
pt=function(f){var xs=sl(arguments,1);return function(){return f.apply(N,xs.concat(sl(arguments)))}}
udfq=pt(to,'undefined');
inval=function(s,a){error("Invalid argument for "+s+": `"+json(a)+"`")}
invals=function(s,a,b){error("Invalid arguments for "+s+": `"+json(a)+"` and `"+json(b)+"`")}

tokens=function(input,st){
  var t={},s=0,p=0,w=0,ts=[];
  t.nextChar=function(){
    if(p>=input.length){w=0;return eof}
    var c=input[p];w=1;p+=w;return c}
  t.backup=function(){p-=w}
  t.peek=function(){var c=this.nextChar();this.backup();return c}
  t.accept=function(valid){
    if(valid.indexOf(this.nextChar())>=0)return 1;
    this.backup();return 0}
  t.acceptRun=function(valid){
    while(valid.indexOf(this.nextChar())>=0){}
    this.backup()}
  t.until=function(stop){
    while(1){
      var c=this.nextChar();
      if(c==eof)return;
      if(stop.indexOf(c)>=0){this.backup();return}}}
  t.done=function(){return this.peek()==eof}
  t.ignore=function(){s=p}
  t.emit=function(type,part,f){ts.push({type:type,value:(f||function(x){return x})(input.slice(s,p)),part:part});s=p}
  while(st!=N)st=st(t);return ts}

exports.lex=lex=function(input){
  var init,word,symbol,number,string,each,space;
  var syms=' `~!@#$%^&*,.<>/?=+\\|-_;:"\'()[]{}',digits='0123456789',stop=syms+digits+' \n\t';
  init=function(t){
    var e=t.emit;
    while(1){
      if(t.done())return;
      switch(t.nextChar()){
        case ' ':return space;
        case '`':t.ignore();return symbol;
        case '~':e('tilde','verb');break;
        case '!':e('bang','verb');break;
        case '@':e('at','verb');break;
        case '#':e('hash','verb');break;
        case '$':e('dollar','verb');break;
        case '%':e('percent','verb');break;
        case '^':e('caret','verb');break;
        case '&':e('amp','verb');break;
        case '*':e('star','verb');break;
        case ',':e('comma','verb');break;
        case '.':e('dot','verb');break;
        case '<':e('langle','verb');break;
        case '>':e('rangle','verb');break;
        case '/':e('slash','adverb');break;
        case '?':e('query','verb');break;
        case '=':e('equals','verb');break;
        case '+':e('plus','verb');break;
        case '\\':e('bash','adverb');break;
        case '|':e('pipe','verb');break;
        case '-':e('dash','verb');break;
        case '_':e('under','verb');break;
        case ';':e('semi');break;
        case ':':e('colon','verb');break;
        case '"':t.ignore();return string;
        case '\'':return each;
        case '(':e('laren');break;
        case ')':e('raren');break;
        case '[':e('lacket');break;
        case ']':e('racket');break;
        case '{':e('lace');break;
        case '}':e('race');break;
        case 'C':e('channel','noun');break;
        case 'D':e('dict','verb');break;
        case 'N':e('nil','noun');break;
        case '\n':e('semi');break;
        default:t.backup();return t.accept(digits)?number:word}}}
  word=function(t){t.until(stop);t.emit('word','noun');return init}
  symbol=function(t){t.until(stop);t.emit('symbol','noun');return init}
  number=function(t){t.acceptRun(digits);if(t.accept('.')){t.acceptRun(digits);t.emit('float','noun')}else t.emit('int','noun');return init}
  string=function(t){
    t.until('"\\');
    if(t.peek()=='"'){t.emit('string','noun',function(s){return s.replace('\\"','"')});t.accept('"');t.ignore();return init}
    else{t.accept('\\');t.accept('"');return string}}
  each=function(t){
    switch(t.nextChar()){
      case '/':t.emit('eachRight','adverb');break;
      case '\\':t.emit('eachLeft','adverb');break;
      case ':':t.emit('eachPair','adverb');break;
      default:t.backup();t.emit('each','adverb');break}
    return init}
  space=function(t){
    if(t.accept('/')){t.until('\n');t.ignore();return init}
    else{t.ignore();return init}}
  return tokens(input,init)}

isNum=function(x){return x.type=='int'||x.type=='float'}
expr=function(ts){
  if(ts.length==1)return ts[0];
  var st,bind,i=ts.length-1;
  st=function(a,b){
    return isNum(a)&&isNum(b)               ? 5
          :a.type=='vector'&&isNum(b)       ? 5
          :a.part=='noun'&&b.part=='noun'   ? 1
          :a.part=='verb'&&b.part=='verb'   ? 1
          :a.part=='verb'&&b.part=='noun'   ? 2
          :a.part=='noun'&&b.part=='verb'   ? 3
          :a.part=='noun'&&b.part=='adverb' ? 4
          :a.part=='verb'&&b.part=='adverb' ? 4
          :0}
  bind=function(a,b){ts.splice(i-1,2,
     isNum(a)&&isNum(b)               ? {type:'vector',part:'noun',values:[a,b]}
    :a.type=='vector'&&isNum(b)       ? {type:'vector',part:'noun',values:a.values.concat([b])}
    :a.part=='noun'&&b.part=='noun'   ? {type:'apply',part:'noun',func:a,arg:b}
    :a.part=='noun'&&b.part=='verb'   ? {type:'curry',part:'verb',func:b,arg:a}
    :a.part=='noun'&&b.part=='adverb' ? {type:'modNoun',part:'verb',mod:b,noun:a}
    :a.part=='verb'&&b.part=='noun'   ? {type:'applyMonad',part:'noun',func:a,arg:b}
    :a.part=='verb'&&b.part=='verb'   ? {type:'compose',part:'verb',f:a,g:b}
    :a.part=='verb'&&b.part=='adverb' ? {type:'modVerb',part:'verb',mod:b,verb:a}
    :error('Invalid operation: '+a.value+' '+b.value))};
  while(ts.length>1){
    i=i>ts.length-1?ts.length-1:i;
    if(ts.length==2){bind(ts[i-1],ts[i]);break}
    if(i==1){bind(ts[i-1],ts[i]);continue}
    if(st(ts[i-2],ts[i-1])<st(ts[i-1],ts[i])){bind(ts[i-1],ts[i]);continue}
    i--}
  return ts[0]}
exprs=function(ts){
  var e=ts.length;
  for(var i=e-1;i>=0;i--){
    if(i==0)ts.splice(i,e-i,ts.slice(i,e));
    if(ts[i].type=='semi'){ts.splice(i,e-i,ts.slice(i+1,e));e=i}}
  for(i=0;i<ts.length;i++)ts.splice(i,1,expr(ts[i]));
  return ts}
wraps=function(ts){
  var i=ts.length-1,t,find=function(ty,f){for(var j=i;j<ts.length;j++)if(ts[j].type==ty){var tss=ts.slice(i+1,j),tss2=tss.slice();ts.splice(i,j-i+1,f(exprs(tss),tss2));return}unmatched(t.type)};
  for(i=ts.length-1;i>=0;i--){
    t=ts[i];
    if(t.type=='laren')find('raren',function(es){return es.length==1?es[0]:{type:'list',part:'noun',values:es}});
    else if(t.type=='lacket')find('racket',function(es){return {type:'argList',part:'noun',args:es}});
    else if(t.type=='lace')find('race',function(es,tss){
      var args=tss.filter(function(t){return t.type=='word'&&(t.value=='x'||t.value=='y'||t.value=='z')}).map(function(t){return t.value});
      return {type:'func',part:'noun',args:args,body:es}})}
  return ts}
exports.parse=parse=function(src){return exprs(wraps(lex(src)))}

exports.run=function(src,r,ops){
  eval=function(tr,r,env){
    return udfq(tr.type)                           ? r(tr)
          :tr.type=='apply'||tr.type=='applyMonad' ? evall([tr.func,tr.arg],function(f,x){if(!funq(f))return error('Not callable: '+f);f.call(N,r,[x])},env)
          :tr.type=='curry'                        ? evall([tr.func,tr.arg],function(f,x){r(function(R,y){f(R,[x,y[0]])})},env)
          :tr.type=='func'                         ? r(function(R,a){var e={};for(var i=0;i<tr.args.length;i++)e[tr.args[i]]=a[i];evals(tr.body,R,e)})
          :tr.type=='vector'                       ? evalSeq(tr.values,r,env)
          :tr.type=='list'                         ? evalSeq(tr.values,r,env)
          :tr.type=='word'                         ? eval(env[tr.value]||ops[tr.value],r,{})
          :symq(tr)                                ? r(strTsym(tr.value))
          :tr.type=='int'                          ? r(parseInt(tr.value))
          :tr.type=='float'                        ? r(parseFloat(tr.value))
          :tr.type=='string'                       ? r(tr.value)
          :tr.type=='nil'                          ? r(N)
          :ops[tr.type]                            ? r(ops[tr.type])
          :error('Invalid AST: '+json(tr))}
  evals=function(es,r,env){var i=0,next=function(rs){i<es.length?eval(es[i++],next,env):r(rs)};next()}
  evall=function(es,r,env){var i=0,out=[],next=function(rs){out.push(rs);i<es.length?eval(es[i++],next,env):r.apply(N,out)};eval(es[i++],next,env)}
  evalSeq=function(es,r,env){var i=0,out=[],next=function(rs){out.push(rs);i<es.length?eval(es[i++],next,env):r(arrTseq(out))};eval(es[i++],next,env)}
  evals(parse(src),r,{})}

var numq,mapq,seqq,vecq,funq,symq,vdoq,ich,arrTseq,seqTdic,strTsym,count,nth;
ich=function(){var ms=sl(arguments);return function(x){return ms.every(function(m){return to('function',x[m])})}}
numq=pt(to,'number')
symq=function(x){return x.type=='symbol'}
funq=ich('call')
seqq=ich('next','first','prepend','append');
mapq=ich('get','assoc','dissoc','remap');
vecq=function(x){return numq(x)||seqq(x)}

strTsym=function(v){var s={type:'symbol',value:v,
  call:function(N,R,a){a.call(N,R,[s])}};return s}
arrTseq=(function(){
  var s=function(xs){return {
    empty:s.empty,
    first:function(){return xs[0]},
    next:function(){return xs.length>1?arrTseq(xs.slice(1)):N},
    prepend:function(x){return arrTseq([x].concat(xs))},
    append:function(x){return arrTseq(xs.concat([x]))}}}
  s.empty=function(){return s([])}
  return s})()
seqTdic=function(ps){
  var p=ps,get,d;while(p){if(!symq(p.first().first()))return error('Dict with non-symbol keys');p=p.next()}
  get=function(R,a){
    if(!symq(a))return error('Dict lookup with non-symbol '+json(a));var p=ps,k=a.value;
    while(p){if(p.first().first().value==k)return R(p.first().next().first());p=p.next()}R(N)}
  d={
    call:function(_,R,a){get(R,a[0])},
    get:get,
    assoc:function(R){},
    dissoc:function(R){},
    remap:function(R,f,a){
      var out=arrTseq.empty(),p=ps,x;
      if(udfq(a)){while(p)x=p.first(),out=out.append(arrTseq([x.first(),f(x.next().first())])),p=p.next();return R(seqTdic(out))}
      R(N)}}
  return d}

reduce=function(f,m){
  var args=sl(arguments,2);
  while(args.every(function(a){return a})){
    m=f.apply(N,[m].concat(args.map(function(a){return a.first()})));
    args=args.map(function(a){return a.next();})}
  return m}
map=function(f){
  var rf=function(m){return m.append(f.apply(N,sl(arguments,1)))}
  return reduce.apply(N,[rf,arguments[1].empty()].concat(sl(arguments,1)))}
vdoq=function(a,b){
  return (numq(a)||mapq(a)||seqq(a))&&udfq(b)||
         (numq(a)||mapq(a)||seqq(a))&&numq(b)||
         (numq(a)||mapq(a))&&mapq(b)||
         (numq(a)||seqq(b))&&seqq(b)}
vdo=function(r,f,a,b){
  numq(a)&&udfq(b)?r(f(a))
 :mapq(a)&&udfq(b)?a.remap(r,f)
 :seqq(a)&&udfq(b)?r(map(f,a))
 :numq(a)&&numq(b)?r(f(a,b))
 :mapq(a)&&numq(b)?a.remap(r,function(x){return f(x,b)})
 :numq(a)&&mapq(b)?b.remap(r,function(y){return f(a,y)})
 :mapq(a)&&mapq(b)?a.remap(r,f,b)
 :seqq(a)&&numq(b)?r(map(function(x){return f(x,b)},a))
 :numq(a)&&seqq(b)?r(map(function(y){return f(a,y)},b))
 :seqq(a)&&seqq(b)?r(map(f,a,b))
 :r(udf)}
count=function(xs){var c=0;while(xs)c+=1,xs=xs.next();return c}
nth=function(xs,n){var c=0;while(xs&&c<n)xs=xs.next();return xs&&xs.first()}
drop=function(n,xs){
  var l=count(xs);
  if(n>=0){for(var i=0;i<n;i++)xs=xs.next();return xs}
  else if(l)return take(l+n,xs);
  else inval('Cannot drop from end of sequence with undefined end')}
take=function(n,xs){
  var ys,l=count(xs);
  if(n>=0){ys=arrTseq.empty();for(var i=0;i<n;i++)ys=ys.append(xs.first()),xs=xs.next();return ys}
  else if(l)return drop(l+n,xs);
  else inval('Cannot take from end of sequence with undefined end')}
concat=function(xs,ys){while(ys)xs=xs.append(ys.first()),ys=ys.next();return xs}
reverse=function(xs){var ys=arrTseq.empty();while(xs)ys=ys.prepend(xs.first()),xs=xs.next();return ys}

arit=function(){var arities=arguments;return function(R,a){arities[a.length-1].apply(N,[R].concat(a))}}
exports.defaultOps={
  tilde:arit(
    function(R,a){vdoq(a)?vdo(R,function(x){return bl(!x)},a):inval('~',a)},
    function(R,a,b){numq(a)&&numq(b)?R(a==b):seqq(a)&&seqq(b)?R(bl(count(a)==count(b)&&reduce(function(m,x,y){return m&x==y},1,a,b))):invals('~',a,b)}),
  plus:arit(N,function(R,a,b){vdoq(a,b)?vdo(R,function(x,y){return x+y},a,b):invals('+',a,b)}),
  dash:arit(
    function(R,a){vecq(a)?vdo(R,function(x){return -x},a):inval('-',a)},
    function(R,a,b){vecq(a)&&vecq(b)?vdo(R,function(x,y){return x-y},a,b):invals('-',a,b)}),
  star:arit(N,function(R,a,b){vecq(a)&&vecq(b)?vdo(R,function(x,y){return x*y},a,b):invals('*',a,b)}),
  percent:arit(
    function(R,a){vecq(a)?vdo(R,function(x){return 1/x},a):inval('%',a)},
    function(R,a,b){vecq(a)&&vecq(b)?vdo(R,function(x,y){return x/y},a,b):invals('%',a,b)}),
  bang:arit(
    function(R,a){numq(a)?function(){var i=0,out=arrTseq.empty();for(;i<a;i++)out=out.append(i);R(out)}():inval('!',a)},
    function(R,a,b){numq(a)&&numq(b)?R(a%b):invals('!',a,b)}),
  at:arit(
    function(R,a){R(bl(numq(a)||symq(a)))},
    function(R,a,b){funq(a)?a.call(N,R,b):invals('@',a,b)}),
  hash:arit(
    function(R,a){seqq(a)?R(count(a)):inval('#',a)},
    function(R,a,b){numq(a)&&seqq(b)?R(take(a,b)):invals('#',a,b)}),
  under:arit(
    function(R,a){vecq(a)?vdo(R,function(x){return Math.floor(x)},a):inval('_',a)},
    function(R,a,b){numq(a)&&seqq(b)?R(drop(a,b)):invals('_',a,b)}),
  caret:arit(N,function(R,a,b){vecq(a)&&vecq(b)?vdo(R,function(x,y){return Math.pow(x,y)},a,b):invals('^',a,b)}),
  langle:arit(N,function(R,a,b){vecq(a)&&vecq(b)?vdo(R,function(x,y){return bl(x<y)},a,b):invals('<',a,b)}),
  rangle:arit(N,function(R,a,b){vecq(a)&&vecq(b)?vdo(R,function(x,y){return bl(x>y)},a,b):invals('>',a,b)}),
  amp:arit(N,function(R,a,b){vecq(a)&&vecq(b)?vdo(R,function(x,y){return x>y?y:x},a,b):invals('&',a,b)}),
  pipe:arit(
    function(R,a){seqq(a)?R(reverse(a)):inval('|',a)},
    function(R,a,b){vecq(a)&&vecq(b)?vdo(R,function(x,y){return x>y?x:y},a,b):invals('|',a,b)}),
  equals:arit(N,
    function(R,a,b){
      vecq(a)&&vecq(b)               ? vdo(R,function(x,y){return bl(x==y)},a,b)
     :to('string',a)&&to('string',b) ? R(bl(a==b))
     :symq(a)&&symq(b)               ? R(bl(a.value==b.value))
     :R(0)}),
  comma:arit(
    function(R,a){numq(a)?R(arrTseq.empty().append(a)):inval(',',a)},
    function(R,a,b){
      numq(a)&&numq(b)?R(arrTseq.empty().append(a).append(b))
     :numq(a)&&seqq(b)?R(b.prepend(a))
     :seqq(a)&&numq(b)?R(a.append(b))
     :seqq(a)&&seqq(b)?R(concat(a,b))
     :invals(',',a,b)}),
  dict:arit(function(R,a){R(seqTdic(a))}),
}
