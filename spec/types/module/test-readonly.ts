import * as ko from "knockout";

function testReadonlyObservable() {
    const write = ko.observable("foo");
    write("bar");
    const read: ko.ReadonlyObservable<string> = write;

    read(); // $ExpectType string
    read.subscribe(() => { });  // Can still subscribe
    read.peek(); // Can peek
    read.getSubscriptionsCount(); // Can check subscriptions

    // @ts-expect-error - Can't write
    read("foo");
    // @ts-expect-error - Can't call valueHasMutated
    read.valueHasMutated();
    // @ts-expect-error - Can't call notifySubscribers
    read.notifySubscribers("foo");
    // @ts-expect-error - Can't extend
    read.extend({ notify: 'always' });

    // Can cast back to writable
    const writeAgain = read as ko.Observable<string>;
    writeAgain("bar");

    // @ts-expect-error - Can't assign to writable observable
    const tryWritable: ko.Observable<string> = read;
};

function testReadonlyObservableArray() {
    const write = ko.observableArray(["foo"]);
    write(["bar"]);
    write.push("foo");

    // Readonly observable array
    const read: ko.ReadonlyObservableArray<string> = write;
    read(); // Can read
    read.slice(0, 1); // Can slice
    read.indexOf("foo"); // Can indexOf
    read.reversed(); // Can get reversed copy
    read.sorted(); // Can get sorted copy
    read.peek(); // Can peek
    read.subscribe(() => { }); // Can subscribe

    // @ts-expect-error - Can't write
    read(["foo"]);
    // @ts-expect-error - Can't push
    read.push("bar");
    // @ts-expect-error - Can't pop
    read.pop();
    // @ts-expect-error - Can't remove
    read.remove("foo");
    // @ts-expect-error - Can't replace
    read.replace("foo", "bar");
    // @ts-expect-error - Can't destroyAll
    read.destroyAll();

    // Can cast back to writable
    const writeAgain = read as ko.ObservableArray<string>;
    writeAgain(["foo"]);

    // @ts-expect-error - Can't assign to writable array
    const tryWritable: ko.ObservableArray<string> = read;

    // Can assign to ReadonlyObservable
    const readObs: ko.ReadonlyObservable<string[]> = read;
    readObs();
    readObs.peek();
    // @ts-expect-error
    readObs([3]);
}

function testReadonlyComputed() {
    // Writable computed
    const write: ko.WritableComputed<string> = ko.computed({
        read: () => "bar",
        write: (x) => { },
    });
    write("foo"); // Can write
    write.dispose(); // Can dispose
    write.peek(); // Can peek
    write.extend({ notify: 'always' }); // Can extend

    // Read-only computed (cast from writable)
    const read: ko.Computed<string> = write;
    read();
    read.subscribe(() => { }); // Can subscribe
    read.peek(); // Can peek
    read.isActive(); // Can check active
    read.getDependenciesCount(); // Can get deps count
    read.dispose(); // Can dispose
    read.extend({ notify: 'always' }); // Can extend
    // @ts-expect-error - Can't write
    read("bar");

    // ko.computed() without write option returns read-only
    const normal1 = ko.computed({ read: () => "bar" });
    // @ts-expect-error
    normal1("foo");

    const normal2 = ko.computed(() => "bar");
    // @ts-expect-error
    normal2("foo");

    // pureComputed without write option returns read-only
    const pure1 = ko.pureComputed({ read: () => "bar" });
    // @ts-expect-error
    pure1("foo");

    const pure2 = ko.pureComputed(() => "bar");
    // @ts-expect-error
    pure2("foo");

    // pureComputed with write option returns writable
    const writablePure = ko.pureComputed({
        read: () => "bar",
        write: (x: string) => { },
    });
    writablePure("foo"); // Can write
}

function testComputedAsReadonlyObservable() {
    // Computed should be assignable to ReadonlyObservable
    const comp = ko.computed(() => 42);
    const readOnly: ko.ReadonlyObservable<number> = comp;
    readOnly();
    readOnly.peek();
    readOnly.subscribe(() => { });
    // @ts-expect-error
    readOnly(5);
}

function testAsSubscribable() {
    // See https://github.com/knockout/knockout/issues/2623
    // Computed should be assignable to Subscribable (structural compatibility)
    const comp = ko.computed(() => 42);
    const sub: ko.Subscribable<number> = comp;
    sub();
    sub.subscribe(() => { });

    // WritableComputed should be assignable to Subscribable
    const wcomp = ko.computed({ read: () => 42, write: (x: number) => { } });
    const sub2: ko.Subscribable<number> = wcomp;

    // Observable should be assignable to Subscribable
    const obs = ko.observable(42);
    const sub3: ko.Subscribable<number> = obs;

    // ObservableArray should be assignable to Subscribable
    const arr = ko.observableArray([1, 2]);
    const sub4: ko.Subscribable<number[]> = arr;
}
